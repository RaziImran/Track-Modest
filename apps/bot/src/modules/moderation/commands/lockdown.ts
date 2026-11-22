import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
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

export const lockdownCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock down or unlock all public text channels in the server.")
    .setDescriptionLocalizations(localizationsFor("lockdown"))
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Lock all public text channels (deny @everyone SendMessages).")
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for lockdown").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End lockdown and restore all channel overwrites.")
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for ending lockdown").setRequired(false),
        ),
    ),
  module: "moderation",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const subcommand = interaction.options.getSubcommand();
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:lockdown:error.notInServer"));
      return;
    }

    const actorId = interaction.user.id;
    const redisUrl = (cfg as any)?.redisUrl ?? process.env["REDIS_URL"];

    const textChannels = guild.channels.cache.filter(
      (ch: any) => ch.isText() && ch.type !== 4, // exclude news channels? actually include all text
    );

    let lockedCount = 0;
    let failedCount = 0;

    if (subcommand === "start") {
      for (const ch of textChannels.values()) {
        if (!ch?.isText()) continue;
        try {
          const existing = ch.permissionOverwrites.cache.get(EVERYONE_ROLE_ID);
          const previousOverwrite = existing
            ? {
                allow: existing.allow.toArray(),
                deny: existing.deny.toArray(),
              }
            : null;

          await ch.permissionOverwrites.edit(EVERYONE_ROLE_ID, {
            SendMessages: false,
          });

          if (redisUrl && previousOverwrite !== null) {
            try {
              const redis = await import("@modest/shared").then((m) => m.createRedis(redisUrl));
              await redis.set(
                `lockdown:${ch.id}`,
                JSON.stringify({ previousOverwrite }),
                "EX",
                86400 * 7,
              );
              await redis.disconnect();
            } catch {
              // Redis failure shouldn't block lockdown
            }
          }

          lockedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      await sendModLog(
        guild,
        cfg,
        ctx.t("moderation:lockdown:modlog.start.title"),
        ctx.t("moderation:lockdown:modlog.start.body", {
          moderator: `<@${actorId}>`,
          reason,
          lockedCount,
          failedCount,
        }),
        COLORS.moderation.ban,
      );

      await interaction.reply({
        content: ctx.t("moderation:lockdown:success.start", {
          lockedCount,
        }) + (failedCount > 0 ? ` (${failedCount} failed)` : ""),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "end") {
      let restoredCount = 0;
      let failedRestoreCount = 0;

      if (redisUrl) {
        for (const ch of textChannels.values()) {
          if (!ch?.isText()) continue;
          try {
            const redis = await import("@modest/shared").then((m) => m.createRedis(redisUrl));
            const raw = await redis.get(`lockdown:${ch.id}`);
            await redis.disconnect();
            if (raw) {
              const data = JSON.parse(raw);
              if (data.previousOverwrite) {
                await ch.permissionOverwrites.edit(EVERYONE_ROLE_ID, {
                  allow: data.previousOverwrite.allow,
                  deny: data.previousOverwrite.deny,
                });
              } else {
                await ch.permissionOverwrites.delete(EVERYONE_ROLE_ID);
              }
              await redis.del(`lockdown:${ch.id}`);
              restoredCount += 1;
            }
          } catch {
            failedRestoreCount += 1;
          }
        }
      }

      await sendModLog(
        guild,
        cfg,
        ctx.t("moderation:lockdown:modlog.end.title"),
        ctx.t("moderation:lockdown:modlog.end.body", {
          moderator: `<@${actorId}>`,
          reason,
          restoredCount,
          failedRestoreCount,
        }),
        COLORS.moderation.ban,
      );

      await interaction.reply({
        content: ctx.t("moderation:lockdown:success.end", {
          restoredCount,
        }) + (failedRestoreCount > 0 ? ` (${failedRestoreCount} failed)` : ""),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    await ctx.error(ctx.t("moderation:lockdown:error.unknownSubcommand"));
  },
};
