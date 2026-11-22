import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import { createRedis } from "@modest/shared";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";

const EVERYONE_ROLE_ID = "@everyone";

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

export const channelCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock, unlock, or set slowmode on a channel.")
    .setDescriptionLocalizations(localizationsFor("lock"))
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription("Deny @everyone SendMessages in a channel.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to lock (defaults to current channel)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for locking").setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Auto-unlock after this duration (e.g. 1h, 30m)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription("Restore @everyone SendMessages overwrite in a channel.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to unlock (defaults to current channel)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("slowmode")
        .setDescription("Set channel slowmode (0–21600 seconds).")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to set slowmode on (defaults to current channel)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("seconds")
            .setDescription("Slowmode delay in seconds (0 to disable)")
            .setMinValue(0)
            .setMaxValue(21600)
            .setRequired(true),
        ),
    ),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const subcommand = interaction.options.getSubcommand();

    const guild = interaction.guild;
    const channel = interaction.channel;
    if (!guild || !channel?.isText()) {
      await ctx.error(ctx.t("moderation:channel:error.notInServer"));
      return;
    }

    const targetChannelId =
      interaction.options.getChannel("channel")?.id ?? channel.id;
    const targetChannel = guild.channels.cache.get(targetChannelId);
    if (!targetChannel?.isText()) {
      await ctx.error(ctx.t("moderation:channel:error.channelNotFound"));
      return;
    }

    const actorId = interaction.user.id;
    const targetEveryoneOverwrite = targetChannel.permissionOverwrites.cache.get(
      EVERYONE_ROLE_ID,
    );

    if (subcommand === "lock") {
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      const durationRaw = interaction.options.getString("duration");

      // Store previous overwrite before locking
      const previousOverwrite = targetEveryoneOverwrite
        ? {
            allow: targetEveryoneOverwrite.allow.toArray(),
            deny: targetEveryoneOverwrite.deny.toArray(),
          }
        : null;

      try {
        await targetChannel.permissionOverwrites.edit(EVERYONE_ROLE_ID, {
          SendMessages: false,
        });
      } catch {
        await ctx.error(ctx.t("moderation:channel:error.missingPermissions"));
        return;
      }

      // Store previous overwrite in Redis for later restore
      const redisUrl = (cfg as any)?.redisUrl ?? process.env["REDIS_URL"];
      if (redisUrl && previousOverwrite !== null) {
        try {
          const redis = createRedis(redisUrl);
          await redis.set(
            `lock:${targetChannelId}`,
            JSON.stringify({ previousOverwrite, lockedBy: actorId, lockedAt: Date.now() }),
            "EX",
            86400 * 7, // 7 days TTL
          );
          await redis.disconnect();
        } catch {
          // Redis failure shouldn't block the lock action
        }
      }

      await sendModLog(
        guild,
        cfg,
        ctx.t("moderation:channel:modlog.lock.title"),
        ctx.t("moderation:channel:modlog.lock.body", {
          channel: `<#${targetChannelId}>`,
          moderator: `<@${actorId}>`,
          reason,
        }),
        COLORS.moderation.ban,
      );

      const durationLine = durationRaw ? ` for ${durationRaw}` : "";
      await interaction.reply({
        content: ctx.t("moderation:channel:success.lock", {
          channel: `<#${targetChannelId}>`,
          duration: durationLine,
        }),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "unlock") {
      const redisUrl = (cfg as any)?.redisUrl ?? process.env["REDIS_URL"];
      let restored = false;

      if (redisUrl) {
        try {
          const redis = createRedis(redisUrl);
          const raw = await redis.get(`lock:${targetChannelId}`);
          await redis.disconnect();
          if (raw) {
            const data = JSON.parse(raw);
            if (data.previousOverwrite) {
              await targetChannel.permissionOverwrites.edit(EVERYONE_ROLE_ID, {
                allow: data.previousOverwrite.allow,
                deny: data.previousOverwrite.deny,
              });
            } else {
              await targetChannel.permissionOverwrites.delete(EVERYONE_ROLE_ID);
            }
            await redis.del(`lock:${targetChannelId}`);
            restored = true;
          }
        } catch {
          // Redis failure; fall through
        }
      }

      if (!restored) {
        try {
          await targetChannel.permissionOverwrites.delete(EVERYONE_ROLE_ID);
        } catch {
          await ctx.error(ctx.t("moderation:channel:error.missingPermissions"));
          return;
        }
      }

      await sendModLog(
        guild,
        cfg,
        ctx.t("moderation:channel:modlog.unlock.title"),
        ctx.t("moderation:channel:modlog.unlock.body", {
          channel: `<#${targetChannelId}>`,
          moderator: `<@${actorId}>`,
        }),
        COLORS.moderation.ban,
      );

      await interaction.reply({
        content: ctx.t("moderation:channel:success.unlock", {
          channel: `<#${targetChannelId}>`,
        }),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "slowmode") {
      const seconds = interaction.options.getInteger("seconds", true);
      try {
        await targetChannel.setRateLimitPerUser(seconds);
      } catch {
        await ctx.error(ctx.t("moderation:channel:error.missingPermissions"));
        return;
      }

      await sendModLog(
        guild,
        cfg,
        ctx.t("moderation:channel:modlog.slowmode.title"),
        ctx.t("moderation:channel:modlog.slowmode.body", {
          channel: `<#${targetChannelId}>`,
          moderator: `<@${actorId}>`,
          seconds,
        }),
        COLORS.moderation.ban,
      );

      const secondsLine = seconds === 0 ? "disabled" : `${seconds}s`;
      await interaction.reply({
        content: ctx.t("moderation:channel:success.slowmode", {
          channel: `<#${targetChannelId}>`,
          seconds: secondsLine,
        }),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    await ctx.error(ctx.t("moderation:channel:error.unknownSubcommand"));
  },
};
