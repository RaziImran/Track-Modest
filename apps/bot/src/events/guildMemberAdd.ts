import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  GuildVerificationLevel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { client } from "../client.js";
import { prisma } from "@modest/db";
import { getGuildLoggingConfig } from "../modules/logging/repository.js";
import {
  formatMemberJoin,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
} from "../modules/logging/service.js";
import { memberJoinEmbed, sendLogMessage } from "../modules/logging/embeds.js";
import {
  computeSuspicionScore,
  getRaidThreshold,
  isRaid,
  getDefaultAvatar,
  accountAgeDays,
  type RaidState,
} from "../modules/antiraid/service.js";
import { AntiraidRepository } from "../modules/antiraid/repository.js";
import { handleGuildMemberAddVerification } from "../modules/verification/index.js";
import { TemporaryBoostService } from "../modules/config/service.js";
import {
  createTemporaryBoost,
  getActiveTemporaryBoost,
  endTemporaryBoost,
} from "../modules/config/repository.js";
import { scheduleBoostEndJob, cancelBoostEndJob } from "../modules/config/boostQueue.js";
import { COLORS } from "../core/reply.js";

const LOCKDOWN_DURATION_SEC = 15 * 60; // 15 minutes

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

async function sendModLog(
  guild: any,
  cfg: any,
  title: string,
  body: string,
  color: number,
  components?: any[],
): Promise<{ channelId: string; messageId: string } | null> {
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return null;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel || !channel.isTextBased()) return null;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(body)
    .setColor(color)
    .setTimestamp();
  try {
    const sent = await (channel as any).send({
      embeds: [embed],
      ...(components ? { components } : {}),
    });
    return { channelId: channel.id, messageId: sent.id };
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the action.
    return null;
  }
}

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  // §12.2 Verification: add Unverified role to members who need verification
  await handleGuildMemberAddVerification(member);

  const guildId = member.guild.id;

  // Existing logging logic
  const guildConfig = await getGuildLoggingConfig(guildId);
  if (guildConfig) {
    if (shouldLogCategory(guildConfig, "members")) {
      const logChannelId = resolveLogChannel(guildConfig, "members");
      if (logChannelId) {
        const roles = member.roles.cache.map((r) => r.id);
        if (!shouldIgnore(guildConfig, "member-join", member.id, roles, member.user.bot)) {
          const logChannel = client.channels.cache.get(logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            const accountAge = Date.now() - member.user.createdTimestamp;
            const inviteUsed = "Unknown";
            const data = formatMemberJoin({
              guildId,
              userId: member.id,
              userTag: member.user.tag,
              userAvatarUrl: member.user.displayAvatarURL(),
              accountAge,
              inviteUsed,
              timestamp: Date.now(),
            });
            const embed = memberJoinEmbed(data, (key: string) => key);
            await sendLogMessage(logChannel as TextChannel, embed);
          }
        }
      }
    }
  }

  // §12.1 Anti-raid join-spike detection
  const fullConfig = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true, modules: true },
  });
  const overrides = (fullConfig?.overrides as Record<string, unknown> | undefined) ?? {};
  const modules = (fullConfig?.modules as Record<string, boolean> | undefined) ?? {};

  // Only run anti-raid if the antiraid module is enabled
  if (!modules["antiraid"]) return;

  const cfg = {
    raidWindowSec: typeof getCfg(overrides, "raid.windowSec", 60) === "number"
      ? (getCfg(overrides, "raid.windowSec", 60) as number)
      : 60,
    raidMinJoins: typeof getCfg(overrides, "raid.minJoins", 8) === "number"
      ? (getCfg(overrides, "raid.minJoins", 8) as number)
      : 8,
    raidJoinMultiplier: typeof getCfg(overrides, "raid.joinMultiplier", 10) === "number"
      ? (getCfg(overrides, "raid.joinMultiplier", 10) as number)
      : 10,
    raidAction: (getCfg(overrides, "raid.action", "alert") as
      | "alert" | "lock_and_alert" | "lock_kick_new") ?? "alert",
    raidPingMods: getCfg(overrides, "raid.pingMods", false) === true,
  };

  const redisUrl = (getCfg(overrides, "redisUrl", undefined) as string | undefined) ??
    process.env["REDIS_URL"];
  const repo = new AntiraidRepository({ redisUrl });

  // Anti-raid requires Redis; skip if unavailable
  if (!redisUrl) return;

  // Record this join
  const nowMs = Date.now();
  await repo.recordJoin(guildId, member.id, nowMs, cfg.raidWindowSec);

  // Get current join count in window and baseline
  const joinsInWindow = await repo.getJoinWindow(guildId, cfg.raidWindowSec);
  const baseline = await repo.getBaseline(guildId);
  const threshold = getRaidThreshold(cfg, baseline);

  if (!isRaid(joinsInWindow, threshold)) return;

  // §12.1 RAID detected
  const guild = member.guild;

  // 1. Create a 15-minute LOCKDOWN boost
  const service = new TemporaryBoostService({
    createTemporaryBoost,
    getActiveTemporaryBoost,
    endTemporaryBoost,
    scheduleBoostEndJob: async (gid, strictness, endsAt) => {
      const jobId = await scheduleBoostEndJob(gid, strictness, endsAt, redisUrl);
      return jobId;
    },
    cancelBoostEndJob: async (gid) => {
      await cancelBoostEndJob(gid, redisUrl);
    },
  });

  await service.applyBoost({
    guildId,
    strictness: "LOCKDOWN",
    reason: `Anti-raid: ${joinsInWindow} joins in ${cfg.raidWindowSec}s (threshold ${threshold})`,
    startedBy: "system",
    durationSec: LOCKDOWN_DURATION_SEC,
  });

  // 2. Execute raid.action
  let prevVerifyLevel: number | null = null;
  if (cfg.raidAction === "lock_and_alert" || cfg.raidAction === "lock_kick_new") {
    try {
      prevVerifyLevel = guild.verificationLevel;
      await guild.setVerificationLevel(GuildVerificationLevel.High);
    } catch {
      // Failed to set verification level; continue without failing
    }
  }

  // Compute suspicion scores for recent joiners (for alert buttons)
  const suspiciousJoiners: { userId: string; score: number }[] = [];
  if (cfg.raidAction === "lock_kick_new") {
    // Already kicked suspicious accounts above; track them anyway
    try {
      const redis = (await import("@modest/shared")).createRedis(redisUrl);
      const key = `raid:joins:${guildId}`;
      const cutoff = nowMs - cfg.raidWindowSec * 1000;
      await redis.zremrangebyscore(key, 0, cutoff);
      const recentJoiners = await redis.zrange(key, 0, -1);
      await redis.disconnect();

      for (const joinedUserId of recentJoiners) {
        const joinedMember = guild.members.cache.get(joinedUserId);
        if (!joinedMember || joinedMember.user.bot) continue;

        const signals = {
          accountAgeDays: accountAgeDays(joinedMember),
          hasDefaultAvatar: getDefaultAvatar(joinedMember),
          usernameSimilarToRecentJoiners: false,
          createdWithin10MinOfOthers: false,
        };
        const score = computeSuspicionScore(signals);
        if (score >= 4) {
          suspiciousJoiners.push({ userId: joinedUserId, score });
        }
      }
    } catch {
      // Redis failed; skip suspicion scoring
    }
  }

  // Store raid state for alert buttons and boost-end restoration
  const raidState: RaidState = {
    suspiciousJoiners,
    prevVerifyLevel,
    channelId: "", // filled below after posting alert
    messageId: "", // filled below after posting alert
    endsAt: nowMs + LOCKDOWN_DURATION_SEC * 1000,
    action: cfg.raidAction,
  };

  // 3. Alert in mod-log with @here (only if raid.pingMods is on)
  // Buttons: Ban all suspicious, Kick all suspicious, End lockdown, False alarm
  if (cfg.raidPingMods) {
    const rows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`antiraid:ban_suspicious:${guildId}`)
          .setLabel("Ban all suspicious")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`antiraid:kick_suspicious:${guildId}`)
          .setLabel("Kick all suspicious")
          .setStyle(ButtonStyle.Danger),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`antiraid:end_lockdown:${guildId}`)
          .setLabel("End lockdown")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`antiraid:false_alarm:${guildId}`)
          .setLabel("False alarm")
          .setStyle(ButtonStyle.Secondary),
      ),
    ];

    const pingText = cfg.raidPingMods ? "@here " : "";
    const result = await sendModLog(
      guild,
      overrides,
      "🚨 Raid detected",
      `${pingText}${member.user.tag} — Anti-raid triggered: ${joinsInWindow} joins in ${cfg.raidWindowSec}s (threshold: ${threshold}). Lockdown boost active for 15 minutes. Action: ${cfg.raidAction}`,
      COLORS.error,
      rows,
    );

    if (result) {
      raidState.channelId = result.channelId;
      raidState.messageId = result.messageId;
    }
  }

  // Persist raid state for button handlers and boost-end restoration
  await repo.setRaidState(guildId, raidState, LOCKDOWN_DURATION_SEC);

  if (cfg.raidAction === "lock_kick_new") {
    // Kick members who joined during the window with suspicion score >= 4
    let kickedCount = 0;
    for (const sj of suspiciousJoiners) {
      const joinedMember = guild.members.cache.get(sj.userId);
      if (!joinedMember || joinedMember.user.bot) continue;
      try {
        await joinedMember.kick("Anti-raid: high suspicion account during raid");
        kickedCount += 1;
      } catch {
        // Kick failed; continue
      }
    }

    if (kickedCount > 0) {
      await sendModLog(
        guild,
        overrides,
        "🦶 Suspicious accounts kicked",
        `Kicked ${kickedCount} suspicious account(s) during raid.`,
        COLORS.warning,
      );
    }
  }
}
