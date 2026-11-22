import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";
import { ModerationService } from "../service.js";
import {
  getActiveWarnPoints,
  getUserCases,
} from "../repository.js";

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

function formatRelativeTime(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function formatDuration(durationSec: number | null): string {
  if (!durationSec) return "";
  const days = Math.floor(durationSec / 86400);
  const hours = Math.floor((durationSec % 86400) / 3600);
  const minutes = Math.floor((durationSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("<1m");
  return ` (${parts.join(" ")})`;
}

export const historyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show a member's moderation case history and active warning points.")
    .setDescriptionLocalizations(localizationsFor("history"))
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Member to view history for")
        .setRequired(true),
    ),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:history:error.notInServer"));
      return;
    }

    const targetUser = interaction.options.getUser("user", true);
    const targetId = targetUser.id;

    // §10.8: refuse moderating the bot itself or oneself.
    if (targetId === interaction.client?.user?.id) {
      await ctx.error(ctx.t("moderation:history:error.cannotTargetBot"));
      return;
    }
    if (targetId === interaction.user.id) {
      await ctx.error(ctx.t("moderation:history:error.cannotTargetSelf"));
      return;
    }

    const targetMember = guild.members.cache.get(targetId);
    const actorMember = guild.members.cache.get(interaction.user.id);
    const actorHighest = actorMember?.roles.highest;
    const targetHighest = targetMember?.roles.highest;
    const botMember = guild.members.cache.get(interaction.client?.user?.id);
    const botHighest = botMember?.roles.highest;
    const targetIsOwner = targetId === guild.ownerId;
    const targetIsSelf = targetId === interaction.user.id;
    const targetHighestRoleGeActor = Boolean(
      targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0,
    );
    const targetHighestRoleGeBot = Boolean(
      targetHighest && botHighest && targetHighest.comparePosition(botHighest) >= 0,
    );

    const hierarchyErr = checkHierarchy({
      targetIsGuildOwner: targetIsOwner,
      targetIsSelf,
      targetHighestRoleGeActor,
      targetHighestRoleGeBot,
      actorIsOwner: interaction.user.id === guild.ownerId,
    });
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:history:error.hierarchy", { message: hierarchyErr }));
      return;
    }

    const expiryDays =
      typeof getCfg(cfg, "warn.pointExpiryDays", 30) === "number"
        ? (getCfg(cfg, "warn.pointExpiryDays", 30) as number)
        : 30;

    const service = new ModerationService({
      incrementCaseCounter: async () => 0,
      createCase: async () => ({ id: 0, number: 0 }),
      applyRepPenalty: async () => 0,
      getActiveWarnPoints,
      getLadderCasesInWindow: async () => [],
      findCase: async () => null,
      undoCase: async () => {},
      getUserCases,
    });

    const [cases, activePoints] = await Promise.all([
      service.deps.getUserCases(guild.id, targetId),
      service.deps.getActiveWarnPoints(guild.id, targetId, expiryDays),
    ]);

    const embed = new EmbedBuilder()
      .setTitle(t("moderation:history:title", { user: targetUser.displayName ?? targetUser.username }))
      .setDescription(
        t("moderation:history:summary", {
          activePoints,
          caseCount: cases.length,
        }),
      )
      .setColor(COLORS.info)
      .setTimestamp()
      .setFooter({ text: `ID: ${targetId}` });

    if (targetMember?.avatar) {
      embed.setThumbnail(targetMember.displayAvatarURL());
    }

    if (cases.length === 0) {
      embed.addFields({
        name: t("moderation:history:noCases"),
        value: t("moderation:history:noCasesBody"),
        inline: false,
      });
    } else {
      for (const c of cases.slice(0, 20)) {
        const status = c.undone ? " ~~(undone)~~" : "";
        const duration = formatDuration(c.durationSec);
        const pointsText = c.points > 0 ? ` +${c.points} pts` : "";
        const undoneBy = c.undoneBy ? ` — undone by <@${c.undoneBy}>` : "";
        embed.addFields({
          name: `Case #${c.number} — ${c.type}${status}`,
          value:
            `**Reason:** ${c.reason}\n` +
            `**Moderator:** <@${c.moderatorId}>\n` +
            `**When:** ${formatRelativeTime(c.createdAt)}${duration}${pointsText}${undoneBy}`,
          inline: false,
        });
      }
      if (cases.length > 20) {
        embed.addFields({
          name: t("moderation:history:moreCases", { count: cases.length - 20 }),
          value: t("moderation:history:moreCasesBody"),
          inline: false,
        });
      }
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
