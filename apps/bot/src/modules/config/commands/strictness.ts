import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { validateStrictnessBoostInput, validateDurationRange } from "../schemas.js";
import { TemporaryBoostService } from "../service.js";
import {
  createTemporaryBoost,
  endTemporaryBoost,
  getActiveTemporaryBoost,
} from "../repository.js";
import { scheduleBoostEndJob, cancelBoostEndJob } from "../boostQueue.js";
import { COLORS } from "../../../core/reply.js";

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("0m");
  return parts.join(" ");
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
  if (!channel?.isText()) return;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(body)
    .setColor(color)
    .setTimestamp();
  try {
    await channel.send({ embeds: [embed] });
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the action.
  }
}

export const strictnessCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("strictness")
    .setDescription("Manage temporary strictness boosts (admin only).")
    .setDescriptionLocalizations(localizationsFor("strictness"))
    .addSubcommand((sub) =>
      sub
        .setName("boost")
        .setDescription("Temporarily raise strictness to Strict or Lockdown.")
        .addStringOption((opt) =>
          opt
            .setName("level")
            .setDescription("Strictness level to boost to")
            .setRequired(true)
            .addChoices(
              { name: "Strict", value: "STRICT" },
              { name: "Lockdown", value: "LOCKDOWN" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("How long the boost lasts (15m to 24h, e.g. 15m, 2h, 1d)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Reason for the temporary boost")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("boost-end")
        .setDescription("End an active temporary strictness boost early."),
    ),
  module: "config",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";
    const subcommand = interaction.options.getSubcommand();

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("config:strictness:error.notInServer"));
      return;
    }

    const actorId = interaction.user.id;
    const redisUrl = (cfg as any)?.redisUrl ?? process.env["REDIS_URL"];

    if (subcommand === "boost") {
      const level = interaction.options.getString("level", true);
      const durationRaw = interaction.options.getString("duration", true);
      const reason = interaction.options.getString("reason", true);

      const parsed = validateStrictnessBoostInput({ level, duration: durationRaw, reason });
      if ("error" in parsed) {
        await ctx.error(parsed.error);
        return;
      }

      let durationSec: number;
      try {
        durationSec = TemporaryBoostService.parseDuration(parsed.duration);
      } catch {
        await ctx.error(ctx.t("config:strictness:error.invalidDuration"));
        return;
      }

      const durationCheck = validateDurationRange(durationSec);
      if (!durationCheck.ok) {
        await ctx.error(durationCheck.error);
        return;
      }

      // Confirm before applying a server-wide protection change.
      const confirmMessage = ctx.t("config:strictness:confirm.boost", {
        level,
        duration: formatDuration(durationSec),
      });
      const confirmed = await ctx.confirm(confirmMessage);
      if (!confirmed) {
        await ctx.error(ctx.t("config:strictness:cancelled"));
        return;
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + durationSec * 1000);

      const service = new TemporaryBoostService({
        createTemporaryBoost,
        getActiveTemporaryBoost,
        endTemporaryBoost,
        scheduleBoostEndJob: async () => {
          const jobId = await scheduleBoostEndJob(guildId, parsed.level, endsAt, redisUrl);
          return jobId;
        },
        cancelBoostEndJob: async () => {
          await cancelBoostEndJob(guildId, redisUrl);
        },
      });

      const result = await service.applyBoost({
        guildId,
        strictness: parsed.level,
        reason: parsed.reason,
        startedBy: actorId,
        durationSec,
      });

      await sendModLog(
        guild,
        cfg,
        ctx.t("config:strictness:modlog.title"),
        ctx.t("config:strictness:modlog.body", {
          level: parsed.level,
          duration: formatDuration(durationSec),
          reason: parsed.reason,
          moderator: `<@${actorId}>`,
        }),
        COLORS.moderation.ban,
      );

      const message = ctx.t("config:strictness:success.boost", {
        level: parsed.level,
        duration: formatDuration(durationSec),
        endsAt: `<t:${Math.floor(result.endsAt.getTime() / 1000)}:R>`,
      });
      await interaction.reply({ content: message, ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }

    if (subcommand === "boost-end") {
      const active = await getActiveTemporaryBoost(guildId);
      if (!active) {
        await ctx.error(ctx.t("config:strictness:error.noActiveBoost"));
        return;
      }

      const confirmed = await ctx.confirm(ctx.t("config:strictness:confirm.boostEnd"));
      if (!confirmed) {
        await ctx.error(ctx.t("config:strictness:cancelled"));
        return;
      }

      const ended = await endTemporaryBoost(guildId);
      if (!ended) {
        await ctx.error(ctx.t("config:strictness:error.endFailed"));
        return;
      }

      await cancelBoostEndJob(guildId, redisUrl);

      await sendModLog(
        guild,
        cfg,
        ctx.t("config:strictness:modlog.title"),
        ctx.t("config:strictness:modlog.boostEnded", {
          moderator: `<@${actorId}>`,
        }),
        COLORS.moderation.ban,
      );

      await interaction.reply({
        content: ctx.t("config:strictness:success.boostEnd"),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    await ctx.error(ctx.t("config:strictness:error.unknownSubcommand"));
  },
};
