import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

function moderatorName(interaction: any, cfg: any): string {
  const showName = getCfg(cfg, "dm.showModeratorName", true) !== false;
  if (showName) {
    return interaction.user.displayName ?? interaction.user.username ?? "a moderator";
  }
  return "a moderator";
}

function buildSummaryEmbed(targetUser: any, member: any | null, t: any): EmbedBuilder {
  const accountAgeDays = Math.floor(
    (Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24),
  );
  const joinedAt = member?.joinedAt
    ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
    : "Unknown";

  const embed = new EmbedBuilder()
    .setTitle(t("moderation:context:panel.title", { user: targetUser.displayName ?? targetUser.username }))
    .setDescription(t("moderation:context:panel.summary", {
      accountAge: `${accountAgeDays} days`,
      joinedAt,
    }))
    .setColor(COLORS.info)
    .setTimestamp()
    .setFooter({ text: `ID: ${targetUser.id}` });

  if (member?.avatar) {
    embed.setThumbnail(member.displayAvatarURL());
  }

  return embed;
}

function buildPanelButtons(
  isMessageMenu: boolean,
  canWarn: boolean,
  canTimeout: boolean,
  canKick: boolean,
  canBan: boolean,
  targetId: string,
  moderatorId: string,
  messageId: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const row1 = new ActionRowBuilder<ButtonBuilder>();
  if (canWarn) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:context:warn:${targetId}:${moderatorId}`)
        .setLabel("Warn")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (canTimeout) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:context:timeout:${targetId}:${moderatorId}`)
        .setLabel("Timeout")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (canKick) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:context:kick:${targetId}:${moderatorId}`)
        .setLabel("Kick")
        .setStyle(ButtonStyle.Danger),
    );
  }
  if (row1.components.length > 0) rows.push(row1);

  const row2 = new ActionRowBuilder<ButtonBuilder>();
  if (canBan) {
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:context:ban:${targetId}:${moderatorId}`)
        .setLabel("Ban")
        .setStyle(ButtonStyle.Danger),
    );
  }
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId(`mod:context:note:${targetId}:${moderatorId}`)
      .setLabel("Note")
      .setStyle(ButtonStyle.Secondary),
  );
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId(`mod:context:history:${targetId}:${moderatorId}`)
      .setLabel("History")
      .setStyle(ButtonStyle.Secondary),
  );
  if (row2.components.length > 0) rows.push(row2);

  if (isMessageMenu) {
    const row3 = new ActionRowBuilder<ButtonBuilder>();
    const deleteTargetId = messageId ?? targetId;
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:context:delete:${deleteTargetId}:${moderatorId}`)
        .setLabel("Delete message")
        .setStyle(ButtonStyle.Danger),
    );
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:context:deleteWarn:${deleteTargetId}:${moderatorId}`)
        .setLabel("Delete + Warn")
        .setStyle(ButtonStyle.Danger),
    );
    rows.push(row3);
  }

  return rows;
}

export async function sendPanel(
  ctx: CommandContext,
  targetUser: any,
  member: any | null,
  isMessageMenu: boolean,
  messageContent: string | null,
  messageId: string | null,
): Promise<void> {
  const interaction = ctx.interaction as any;
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const guild = interaction.guild;
  const actor = interaction.user;
  const targetId = targetUser.id;
  const moderatorId = actor.id;

  // Permission checks
  const botMember = guild?.members.cache.get(interaction.client?.user?.id);
  const actorMember = guild?.members.cache.get(actor.id);
  const actorHighest = actorMember?.roles.highest;
  const targetHighest = member?.roles.highest;
  const botHighest = botMember?.roles.highest;
  const targetIsOwner = targetId === guild?.ownerId;
  const targetIsSelf = targetId === actor.id;
  const targetHighestRoleGeActor = Boolean(
    targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0,
  );
  const targetHighestRoleGeBot = Boolean(
    targetHighest && botHighest && targetHighest.comparePosition(botHighest) >= 0,
  );

  const canWarn = !targetIsOwner && !targetIsSelf;
  const canTimeout =
    canWarn &&
    !targetHighestRoleGeBot &&
    !targetIsOwner;
  const canKick = canWarn && !targetIsOwner && !targetHighestRoleGeActor;
  const canBan = canWarn && !targetIsOwner && !targetHighestRoleGeActor;

  const embed = buildSummaryEmbed(targetUser, member, t);
  const rows = buildPanelButtons(
    isMessageMenu,
    canWarn,
    canTimeout,
    canKick,
    canBan,
    targetId,
    moderatorId,
    messageId,
  );

  if (isMessageMenu && messageContent) {
    embed.addFields({
      name: t("moderation:context:panel.evidence"),
      value: messageContent.length > 1000 ? `${messageContent.slice(0, 1000)}...` : messageContent,
    });
  }

  await interaction.editReply({
    embeds: [embed],
    components: rows.length > 0 ? rows : [],
  });
}

export async function showReasonModal(
  buttonInteraction: any,
  action: string,
  targetId: string,
  moderatorId: string,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`mod:context:${action}:${targetId}:${moderatorId}`)
    .setTitle(action.charAt(0).toUpperCase() + action.slice(1) + " Reason");

  const reasonInput = new TextInputBuilder()
    .setCustomId(`mod:context:${action}:reason`)
    .setLabel("Reason")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Why are you taking this action?")
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
  );

  if (action === "timeout" || action === "ban") {
    const durationInput = new TextInputBuilder()
      .setCustomId(`mod:context:${action}:duration`)
      .setLabel("Duration (e.g. 1h, 1d, 7d)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Leave blank for permanent")
      .setRequired(false)
      .setMaxLength(20);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
    );
  }

  if (action === "warn") {
    const pointsInput = new TextInputBuilder()
      .setCustomId("mod:context:warn:points")
      .setLabel("Points (1-5)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("1")
      .setRequired(false)
      .setMaxLength(1);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(pointsInput),
    );
  }

  await buttonInteraction.showModal(modal);
}

function parseDuration(input: string): number {
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  const clean = input.trim().toLowerCase().replace(/\s+/g, "");
  if (clean.length === 0) return 0;
  const tokenRe = /(\d+)(s|m|h|d|w)/g;
  let total = 0;
  let consumed = "";
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(clean)) !== null) {
    const value = Number.parseInt(match[1] ?? "0", 10);
    const unit = match[2] ?? "";
    total += value * (units[unit] ?? 0);
    consumed += match[0];
  }
  if (consumed.length === 0 || consumed !== clean) return 0;
  return total;
}

export async function handleModalSubmit(
  interaction: any,
  cfg: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): Promise<boolean> {
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("mod:context:")) return false;

  const parts = customId.split(":");
  // mod:context:<action>:<targetId>:<moderatorId>
  const action = parts[2];
  const targetId = parts[3];
  const moderatorId = parts[4];

  if (!action || !targetId || !moderatorId) return false;

  // Report message: mod:context:report:<messageId>:<reporterId>
  if (action === "report") {
    const messageId = targetId;
    const reporterId = moderatorId;
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: t("moderation:context:error.notInServer"), ephemeral: true });
      return true;
    }
    const reason = interaction.fields.getTextInputValue("mod:context:report:reason");
    const targetMessage = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!targetMessage) {
      await interaction.reply({ content: t("moderation:context:error.messageNotFound"), ephemeral: true });
      return true;
    }

    const { createCase } = await import("../repository.js");
    const { ModerationService } = await import("../service.js");
    const service = new ModerationService({
      incrementCaseCounter: async () => 0,
      createCase,
      applyRepPenalty: async () => 0,
      getActiveWarnPoints: async () => 0,
      getLadderCasesInWindow: async () => [],
      findCase: async () => null,
      undoCase: async () => {},
    });

    try {
      await service.createCase({
        guildId: guild.id,
        type: "NOTE_ONLY",
        targetId: targetMessage.author.id,
        moderatorId: reporterId,
        reason: `Report: ${reason}`,
      });
      await interaction.reply({
        content: t("moderation:context:report.success"),
        ephemeral: true,
      });
    } catch {
      await interaction.reply({
        content: t("moderation:context:error.actionFailed", { action: "report" }),
        ephemeral: true,
      });
    }
    return true;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: t("moderation:context:error.notInServer"), ephemeral: true });
    return true;
  }

  const reason = interaction.fields.getTextInputValue(`mod:context:${action}:reason`);
  const durationRaw =
    action === "timeout" || action === "ban"
      ? interaction.fields.getTextInputValue(`mod:context:${action}:duration`)
      : "";
  const pointsRaw = action === "warn"
    ? interaction.fields.getTextInputValue("mod:context:warn:points")
    : "1";

  const points = Math.min(Math.max(Number.parseInt(pointsRaw, 10) || 1, 1), 5);
  const durationSec = durationRaw ? parseDuration(durationRaw) : undefined;

  const targetMember = guild.members.cache.get(targetId);
  const targetUser = targetMember?.user ?? (await interaction.client.users.fetch(targetId).catch(() => null));
  if (!targetUser) {
    await interaction.reply({ content: t("moderation:context:error.userNotFound"), ephemeral: true });
    return true;
  }

  const botMember = guild.members.cache.get(interaction.client.user.id);
  const actorMember = guild.members.cache.get(moderatorId);
  const actorHighest = actorMember?.roles.highest;
  const targetHighest = targetMember?.roles.highest;
  const botHighest = botMember?.roles.highest;
  const targetIsOwner = targetId === guild.ownerId;
  const targetIsSelf = targetId === moderatorId;
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
    actorIsOwner: moderatorId === guild.ownerId,
  });
  if (hierarchyErr) {
    await interaction.reply({
      content: t("moderation:context:error.hierarchy", { message: hierarchyErr }),
      ephemeral: true,
    });
    return true;
  }

  const { incrementCaseCounter, createCase, applyRepPenalty } = await import("../repository.js");
  const { ModerationService } = await import("../service.js");

  const service = new ModerationService({
    incrementCaseCounter,
    createCase,
    applyRepPenalty,
    getActiveWarnPoints: async () => 0,
    getLadderCasesInWindow: async () => [],
    findCase: async () => null,
    undoCase: async () => {},
  });

  const guildId = guild.id;
  try {
    switch (action) {
      case "warn": {
        await service.applyWarn(guildId, targetId, moderatorId, reason, points);
        await targetMember?.send(
          `You were warned in **${guild.name}**.\n**Reason:** ${reason}\n**Moderator:** ${moderatorName(interaction, cfg)}`,
        ).catch(() => {});
        break;
      }
      case "timeout": {
        if (!durationSec || durationSec > 2419200) {
          await interaction.reply({ content: t("moderation:context:error.invalidDuration"), ephemeral: true });
          return true;
        }
        await service.applyTimeout(guildId, targetId, moderatorId, reason, durationSec);
        await targetMember?.timeout(durationSec * 1000, reason).catch(() => {});
        break;
      }
      case "kick": {
        await service.applyKick(guildId, targetId, moderatorId, reason);
        await targetMember?.kick(reason).catch(() => {});
        break;
      }
      case "ban": {
        await service.applyBan(guildId, targetId, moderatorId, reason, durationSec);
        await guild.bans.create(targetId, { reason, ...(durationSec ? { deleteMessageSeconds: 0 } : {}) }).catch(() => {});
        break;
      }
      case "note": {
        await service.createCase({
          guildId,
          type: "NOTE_ONLY",
          targetId,
          moderatorId,
          reason,
        });
        break;
      }
      case "deleteWarn": {
        // For message context menu: targetId is the message ID
        const messageId = targetId;
        const targetMessage = await interaction.channel?.messages.fetch(messageId).catch(() => null);
        const warnTargetId = targetMessage?.author?.id ?? targetId;
        await service.applyWarn(guildId, warnTargetId, moderatorId, reason, points);
        try {
          await targetMessage?.delete();
        } catch {
          // Message may already be deleted
        }
        break;
      }
    }

    await interaction.reply({
      content: t("moderation:context:success.actioned", { action, user: `<@${targetId}>` }),
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: t("moderation:context:error.actionFailed", { action }),
      ephemeral: true,
    });
  }

  return true;
}

export const moderateUserCommand: BotCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Moderate")
    .setType(2),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;

    const targetUser = interaction.targetUser ?? interaction.targetMember?.user;
    if (!targetUser) {
      await interaction.reply({ content: t("moderation:context:error.userNotFound"), ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const member = guild?.members.cache.get(targetUser.id);

    await interaction.deferReply({ ephemeral: true });
    await sendPanel(ctx, targetUser, member ?? null, false, null, null);
  },
};

export const moderateMessageCommand: BotCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Moderate message")
    .setType(3),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;

    const targetMessage = interaction.targetMessage;
    if (!targetMessage) {
      await interaction.reply({ content: t("moderation:context:error.messageNotFound"), ephemeral: true });
      return;
    }

    const targetUser = targetMessage.author;
    const guild = interaction.guild;
    const member = guild?.members.cache.get(targetUser.id);

    await interaction.deferReply({ ephemeral: true });
    await sendPanel(ctx, targetUser, member ?? null, true, targetMessage.content, targetMessage.id);
  },
};

export const reportMessageCommand: BotCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Report message")
    .setType(3),
  module: "moderation",
  staffLevel: "none",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;

    const targetMessage = interaction.targetMessage;
    if (!targetMessage) {
      await interaction.reply({ content: t("moderation:context:error.messageNotFound"), ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`mod:context:report:${targetMessage.id}:${interaction.user.id}`)
      .setTitle(t("moderation:context:report.title"));

    const reasonInput = new TextInputBuilder()
      .setCustomId("mod:context:report:reason")
      .setLabel(t("moderation:context:report.reasonLabel"))
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(t("moderation:context:report.reasonPlaceholder"))
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
    );

    await interaction.showModal(modal);
  },
};
