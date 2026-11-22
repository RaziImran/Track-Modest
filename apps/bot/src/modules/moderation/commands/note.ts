import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";
import { prisma } from "@modest/db";

function formatRelativeTime(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

export const noteCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Moderation notes for a member.")
    .setDescriptionLocalizations(localizationsFor("note"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a moderation note for a user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Member to add a note for").setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("text").setDescription("Note text").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List moderation notes for a user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Member to list notes for").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a moderation note by ID.")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Note ID to delete").setRequired(true),
        ),
    ),
  module: "moderation",
  staffLevel: "helper",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:note:error.notInServer"));
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const targetUser = interaction.options.getUser("user", true);
      const text = interaction.options.getString("text", true);
      const actorId = interaction.user.id;

      const targetMember = guild.members.cache.get(targetUser.id);
      const actorMember = guild.members.cache.get(actorId);
      const actorHighest = actorMember?.roles.highest;
      const targetHighest = targetMember?.roles.highest;
      const targetIsOwner = targetUser.id === guild.ownerId;
      const targetIsSelf = targetUser.id === actorId;

      const targetHighestRoleGeActor = Boolean(
        targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0,
      );

      const hierarchyErr = checkHierarchy({
        targetIsGuildOwner: targetIsOwner,
        targetIsSelf,
        targetHighestRoleGeActor,
        targetHighestRoleGeBot: false,
        actorIsOwner: actorId === guild.ownerId,
      });
      if (hierarchyErr) {
        await ctx.error(ctx.t("moderation:note:error.hierarchy", { message: hierarchyErr }));
        return;
      }

      await prisma.modNote.create({
        data: {
          guildId: guild.id,
          targetId: targetUser.id,
          authorId: actorId,
          content: text,
        },
      });

      await interaction.reply({
        content: t("moderation:note:success.added", { target: `<@${targetUser.id}>` }),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "list") {
      const targetUser = interaction.options.getUser("user", true);

      const notes = await prisma.modNote.findMany({
        where: { guildId: guild.id, targetId: targetUser.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const embed = new EmbedBuilder()
        .setTitle(t("moderation:note:listTitle", { user: targetUser.displayName ?? targetUser.username }))
        .setColor(COLORS.info)
        .setTimestamp()
        .setFooter({ text: `ID: ${targetUser.id}` });

      if (notes.length === 0) {
        embed.addFields({
          name: t("moderation:note:noNotes"),
          value: t("moderation:note:noNotesBody"),
          inline: false,
        });
      } else {
        for (const n of notes) {
          embed.addFields({
            name: `Note #${n.id}`,
            value: `**Author:** <@${n.authorId}>\n**Content:** ${n.content}\n**When:** ${formatRelativeTime(n.createdAt)}`,
            inline: false,
          });
        }
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "delete") {
      const noteId = interaction.options.getInteger("id", true);
      const actorId = interaction.user.id;

      const note = await prisma.modNote.findUnique({
        where: { id: noteId },
      });

      if (!note || note.guildId !== guild.id || note.deletedAt) {
        await ctx.error(ctx.t("moderation:note:error.notFound"));
        return;
      }

      const actorMember = guild.members.cache.get(actorId);
      const actorHighest = actorMember?.roles.highest;
      const actorIsOwner = actorId === guild.ownerId;

      // Only the author, an owner, or a higher-role staff can delete
      if (
        note.authorId !== actorId &&
        !actorIsOwner &&
        actorHighest &&
        note.authorId &&
        guild.members.cache.get(note.authorId)?.roles.highest.comparePosition(actorHighest) <= 0
      ) {
        await ctx.error(ctx.t("moderation:note:error.cannotDelete"));
        return;
      }

      await prisma.modNote.update({
        where: { id: noteId },
        data: { deletedAt: new Date() },
      });

      await interaction.reply({
        content: t("moderation:note:success.deleted"),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    await ctx.error(ctx.t("moderation:note:error.unknownSubcommand"));
  },
};
