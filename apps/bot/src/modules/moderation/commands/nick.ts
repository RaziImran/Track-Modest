import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";

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

export const nickCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("nick")
    .setDescription("Change another member's server nickname.")
    .setDescriptionLocalizations(localizationsFor("nick"))
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Member whose nickname to change")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("nickname").setDescription("New nickname (leave blank to reset)").setRequired(false),
    ),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:nick:error.notInServer"));
      return;
    }

    const actorId = interaction.user.id;
    const targetUserId = interaction.options.getUser("user")?.id;
    const nickname = interaction.options.getString("nickname") ?? "";

    if (!targetUserId) {
      await ctx.error(ctx.t("moderation:nick:error.userNotFound"));
      return;
    }

    const member = guild.members.cache.get(targetUserId);
    if (!member) {
      await ctx.error(ctx.t("moderation:nick:error.userNotFound"));
      return;
    }

    if (member.user.bot) {
      await ctx.error(ctx.t("moderation:nick:error.cannotNickBot"));
      return;
    }

    // Cannot change owner's nickname
    if (targetUserId === guild.ownerId) {
      await ctx.error(ctx.t("moderation:nick:error.cannotNickOwner"));
      return;
    }

    // Actors cannot change their own nickname via this command
    if (targetUserId === actorId) {
      await ctx.error(ctx.t("moderation:nick:error.cannotNickSelf"));
      return;
    }

    // Bot must have permission to manage nicknames
    const botMember = guild.members.cache.get(interaction.client?.user?.id);
    if (!botMember?.permissions.has("ManageNicknames")) {
      await ctx.error(ctx.t("moderation:nick:error.missingPermissions"));
      return;
    }

    try {
      await member.setNickname(nickname || null);
    } catch {
      await ctx.error(ctx.t("moderation:nick:error.missingPermissions"));
      return;
    }

    await sendModLog(
      guild,
      cfg,
      ctx.t("moderation:nick:modlog.title"),
      ctx.t("moderation:nick:modlog.body", {
        target: `<@${targetUserId}>`,
        moderator: `<@${actorId}>`,
        nickname: nickname || "(reset)",
      }),
      COLORS.moderation.ban,
    );

    await interaction.reply({
      content: ctx.t("moderation:nick:success.changed", {
        target: `<@${targetUserId}>`,
        nickname: nickname || "reset",
      }),
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
