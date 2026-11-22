import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";
import { prisma } from "@modest/db";

export const modstatsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("modstats")
    .setDescription("Moderation statistics for this server.")
    .setDescriptionLocalizations(localizationsFor("modstats"))
    .addUserOption((opt) =>
      opt
        .setName("moderator")
        .setDescription("Filter stats by a specific moderator")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("period")
        .setDescription("Time period for stats")
        .addChoices(
          { name: "Last 7 days", value: "7d" },
          { name: "Last 30 days", value: "30d" },
          { name: "All time", value: "all" },
        )
        .setRequired(false),
    ),
  module: "moderation",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:modstats:error.notInServer"));
      return;
    }

    const moderator = interaction.options.getUser("moderator");
    const periodRaw = (interaction.options.getString("period") ?? "all") as string;

    const now = Date.now();
    let since: Date | undefined;
    if (periodRaw === "7d") since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (periodRaw === "30d") since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const modWhere: Record<string, unknown> = { guildId: guild.id };
    if (moderator) modWhere["moderatorId"] = moderator.id;
    if (since) modWhere["createdAt"] = { gte: since };

    // Counts per action type (non-undone cases)
    const casesByType = await prisma.case.groupBy({
      by: ["type"],
      where: modWhere,
      _count: { type: true },
    });

    // Undo rate
    const totalCases = await prisma.case.count({ where: modWhere });
    const undoneCases = await prisma.case.count({
      where: { ...modWhere, undone: true },
    });

    // Report stats
    const reportWhere: Record<string, unknown> = { guildId: guild.id };
    if (since) reportWhere["createdAt"] = { gte: since };

    const reportsByStatus = await prisma.report.groupBy({
      by: ["status"],
      where: reportWhere,
      _count: { status: true },
    });

    // Median time from report to resolution
    const resolvedReports = await prisma.report.findMany({
      where: { ...reportWhere, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    });

    let medianMinutes: number | null = null;
    if (resolvedReports.length > 0) {
      const diffs = resolvedReports.map(
        (r) =>
          ((r.resolvedAt as Date).getTime() - r.createdAt.getTime()) / 60000,
      );
      diffs.sort((a, b) => a - b);
      const mid = Math.floor(diffs.length / 2);
      medianMinutes =
        diffs.length % 2 === 0
          ? (diffs[mid - 1]! + diffs[mid]!) / 2
          : diffs[mid]!;
    }

    const embed = new EmbedBuilder()
      .setTitle(t("moderation:modstats:title", { period: periodRaw.toUpperCase() }))
      .setDescription(
        t("moderation:modstats:summary", { target: moderator ? `<@${moderator.id}>` : "All moderators" }),
      )
      .setColor(COLORS.info)
      .setTimestamp()
      .setFooter({ text: `ID: ${guild.id}` });

    // Action type counts
    const typeCounts = casesByType.reduce(
      (acc, c) => ({ ...acc, [String(c.type)]: c._count.type }),
      {} as Record<string, number>,
    );

    const typeLines = Object.entries(typeCounts).map(
      ([type, count]) => `• **${type}**: ${count}`,
    );
    if (typeLines.length === 0) typeLines.push(t("moderation:modstats:noCases"));
    embed.addFields({
      name: t("moderation:modstats:actionsByType"),
      value: typeLines.join("\n"),
      inline: false,
    });

    // Undo rate
    const undoRate = totalCases > 0 ? ((undoneCases / totalCases) * 100).toFixed(1) : "0";
    embed.addFields({
      name: t("moderation:modstats:undoRate"),
      value: t("moderation:modstats:undoRateValue", { rate: undoRate, undone: undoneCases, total: totalCases }),
      inline: true,
    });

    // Report stats
    const reportLines = Object.entries(reportsByStatus).map(
      ([status, { _count }]) => `• **${status}**: ${_count.status}`,
    );
    if (reportLines.length === 0) reportLines.push(t("moderation:modstats:noReports"));
    embed.addFields({
      name: t("moderation:modstats:reportsByStatus"),
      value: reportLines.join("\n"),
      inline: false,
    });

    // Median response time
    const medianText =
      medianMinutes !== null
        ? t("moderation:modstats:medianMinutes", { minutes: Math.round(medianMinutes) })
        : t("moderation:modstats:noResolvedReports");
    embed.addFields({
      name: t("moderation:modstats:medianResponseTime"),
      value: medianText,
      inline: true,
    });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
