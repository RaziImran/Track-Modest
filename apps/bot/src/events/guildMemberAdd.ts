import { GuildMember, EmbedBuilder, TextChannel, GuildVerificationLevel } from "discord.js";
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
} from "../modules/antiraid/service.js";
import { AntiraidRepository } from "../modules/antiraid/repository.js";
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
): Promise<void> {
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel || !channel.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(body)
    .setColor(color)
    .setTimestamp();
  try {
    await (channel as any).send({ embeds: [embed] });
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the action.
  }
}

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

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
  if (cfg.raidAction === "lock_and_alert" || cfg.raidAction === "lock_kick_new") {
    // Enable verification for everyone; set guild verification level to High
    try {
      const previousLevel = guild.verificationLevel;
      await guild.setVerificationLevel(GuildVerificationLevel.High);
      // Store previous level for restoration
      if (redisUrl) {
        const redis = (await import("@modest/shared")).createRedis(redisUrl);
        await redis.set(`raid:prevVerifyLevel:${guildId}`, String(previousLevel), "EX", LOCKDOWN_DURATION_SEC);
        await redis.disconnect();
      }
    } catch {
      // Failed to set verification level; continue without failing
    }
  }

  if (cfg.raidAction === "lock_kick_new") {
    // Kick members who joined during the window with suspicion score >= 4
    try {
      const redis = (await import("@modest/shared")).createRedis(redisUrl);
      const key = `raid:joins:${guildId}`;
      const cutoff = nowMs - cfg.raidWindowSec * 1000;
      await redis.zremrangebyscore(key, 0, cutoff);
      const recentJoiners = await redis.zrange(key, 0, -1);
      await redis.disconnect();

      let kickedCount = 0;
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
          try {
            await joinedMember.kick("Anti-raid: high suspicion account during raid");
            kickedCount += 1;
          } catch {
            // Kick failed; continue
          }
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
    } catch {
      // Redis failed; skip kick action
    }
  }

  // 3. Alert in mod-log with @here (only if raid.pingMods is on)
  if (cfg.raidPingMods) {
    await sendModLog(
      guild,
      overrides,
      "🚨 Raid detected",
      `@here ${member.user.tag} — Anti-raid triggered: ${joinsInWindow} joins in ${cfg.raidWindowSec}s (threshold: ${threshold}). Lockdown boost active for 15 minutes. Action: ${cfg.raidAction}`,
      COLORS.error,
    );
  } else {
    await sendModLog(
      guild,
      overrides,
      "🚨 Raid detected",
      `Anti-raid triggered: ${joinsInWindow} joins in ${cfg.raidWindowSec}s (threshold: ${threshold}). Lockdown boost active for 15 minutes. Action: ${cfg.raidAction}`,
      COLORS.warning,
    );
  }
}
