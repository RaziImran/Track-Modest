import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";
import { prisma } from "@modest/db";

function getReportQueueChannelId(cfg: any): string | undefined {
  if (!cfg) return undefined;
  const logChannels = cfg.logChannels as Record<string, string> | undefined;
  return logChannels?.["reportQueue"];
}

export const reportCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Report a user for rule violations.")
    .setDescriptionLocalizations(localizationsFor("report"))
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to report").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Why are you reporting this user?")
        .setRequired(true),
    ),
  module: "moderation",
  staffLevel: "none",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:report:error.notInServer"));
      return;
    }

    const reporter = interaction.user;
    const targetUser = interaction.options.getUser("user", true);
    const reasonText = interaction.options.getString("reason", true);

    // Cannot report yourself
    if (targetUser.id === reporter.id) {
      await ctx.error(ctx.t("moderation:report:error.cannotReportSelf"));
      return;
    }

    // Cannot report the bot
    if (targetUser.id === interaction.client?.user?.id) {
      await ctx.error(ctx.t("moderation:report:error.cannotReportBot"));
      return;
    }

    // Abuse prevention: max 5 reports per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await prisma.report.count({
      where: {
        guildId: guild.id,
        reporterId: reporter.id,
        createdAt: { gte: oneHourAgo },
      },
    });
    if (recentReports >= 5) {
      await ctx.error(ctx.t("moderation:report:error.rateLimited"));
      return;
    }

    const targetMember = guild.members.cache.get(targetUser.id);

    // Hierarchy check - cannot report server owner or higher-role staff via /report
    const actorMember = guild.members.cache.get(reporter.id);
    const actorHighest = actorMember?.roles.highest;
    const targetHighest = targetMember?.roles.highest;
    const targetIsOwner = targetUser.id === guild.ownerId;
    const targetHighestRoleGeActor = Boolean(
      targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0,
    );

    const hierarchyErr = checkHierarchy({
      targetIsGuildOwner: targetIsOwner,
      targetIsSelf: false,
      targetHighestRoleGeActor,
      targetHighestRoleGeBot: false,
      actorIsOwner: reporter.id === guild.ownerId,
    });
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:report:error.hierarchy", { message: hierarchyErr }));
      return;
    }

    // Check if target is a bot
    if (targetUser.bot) {
      await ctx.error(ctx.t("moderation:report:error.cannotReportBot"));
      return;
    }

    // Create Report record
    const report = await prisma.report.create({
      data: {
        guildId: guild.id,
        reporterId: reporter.id,
        targetId: targetUser.id,
        reason: reasonText,
        status: "OPEN",
      },
    });

    // Also create a NOTE_ONLY case for mod visibility
    const { incrementCaseCounter, createCase } = await import("../repository.js");
    await incrementCaseCounter(guild.id);
    const { ModerationService } = await import("../service.js");
    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty: async () => 0,
      getActiveWarnPoints: async () => 0,
      getLadderCasesInWindow: async () => [],
      findCase: async () => null,
      undoCase: async () => {},
      getUserCases: async () => [],
    });
    await service.createCase({
      guildId: guild.id,
      type: "NOTE_ONLY",
      targetId: targetUser.id,
      moderatorId: reporter.id,
      reason: `Report #${report.id}: ${reasonText}`,
      automatic: false,
    });

    // Post to report queue channel
    const queueChannelId = getReportQueueChannelId(cfg);
    if (queueChannelId) {
      const queueChannel = guild.channels.cache.get(queueChannelId);
      if (queueChannel?.isText()) {
        const embed = {
          title: t("moderation:report:queue.title", { id: report.id }),
          description: `**Reporter:** <@${reporter.id}>\n**Target:** <@${targetUser.id}>\n**Reason:** ${reasonText}`,
          color: COLORS.warning,
          timestamp: new Date().toISOString(),
          fields: [
            { name: "Report ID", value: String(report.id), inline: true },
            { name: "Status", value: "OPEN", inline: true },
          ],
        };

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod:report:claim:${report.id}`)
            .setLabel(t("moderation:report:queue.claim"))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mod:report:action:${report.id}`)
            .setLabel(t("moderation:report:queue.takeAction"))
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`mod:report:noaction:${report.id}`)
            .setLabel(t("moderation:report:queue.noAction"))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mod:report:history:${report.id}`)
            .setLabel(t("moderation:report:queue.viewHistory"))
            .setStyle(ButtonStyle.Secondary),
        );

        try {
          await queueChannel.send({ embeds: [embed], components: [row] });
        } catch {
          // Queue channel may be inaccessible; continue without failing.
        }
      }
    }

    await interaction.reply({
      content: t("moderation:report:success.submitted", { id: report.id }),
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
