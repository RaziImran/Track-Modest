import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";
import { prisma } from "@modest/db";

export const staffActivityCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("staffactivity")
    .setDescription("Show staff members with zero moderation actions in the last 30 days.")
    .setDescriptionLocalizations(localizationsFor("staffactivity")),
  module: "moderation",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:staffactivity:error.notInServer"));
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get staff role IDs from config
    const staffRoles = (cfg?.staffRoles as Record<string, string[]> | undefined) ?? {};
    const allStaffRoleIds = new Set<string>();
    for (const roleIds of Object.values(staffRoles)) {
      for (const roleId of roleIds) {
        allStaffRoleIds.add(roleId);
      }
    }

    // Get all staff members
    const staffMembers: Array<{ id: string; user: any }> = [];
    for (const roleId of allStaffRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      for (const member of role.members.values()) {
        if (member.user.bot) continue;
        staffMembers.push({ id: member.id, user: member.user });
      }
    }

    // Deduplicate
    const uniqueStaff = staffMembers.filter(
      (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
    );

    // Get active moderators (those with cases in last 30 days)
    const activeCases = await prisma.case.findMany({
      where: {
        guildId: guild.id,
        createdAt: { gte: thirtyDaysAgo },
        undone: false,
      },
      select: { moderatorId: true },
      distinct: ["moderatorId"],
    });
    const activeModeratorIds = new Set(activeCases.map((c) => c.moderatorId));

    // Staff with zero actions
    const inactiveStaff = uniqueStaff.filter((s) => !activeModeratorIds.has(s.id));

    const embed = new EmbedBuilder()
      .setTitle(t("moderation:staffactivity:title"))
      .setDescription(t("moderation:staffactivity:summary", { total: uniqueStaff.length }))
      .setColor(COLORS.info)
      .setTimestamp()
      .setFooter({ text: `Guild: ${guild.id}` });

    if (inactiveStaff.length === 0) {
      embed.addFields({
        name: t("moderation:staffactivity:noInactive"),
        value: t("moderation:staffactivity:noInactiveBody"),
        inline: false,
      });
    } else {
      const lines = inactiveStaff.map(
        (s) => `• <@${s.id}>`,
      );
      embed.addFields({
        name: t("moderation:staffactivity:inactiveStaff", { count: inactiveStaff.length }),
        value: lines.join("\n"),
        inline: false,
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
