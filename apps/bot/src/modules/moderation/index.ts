import { registerCommand } from "../../core/commandRegistry.js";
import { warnCommand } from "./commands/warn.js";
import { timeoutCommand, untimeoutCommand } from "./commands/timeout.js";
import { kickCommand } from "./commands/kick.js";
import { banCommand } from "./commands/ban.js";
import { softbanCommand } from "./commands/softban.js";
import { unbanCommand } from "./commands/unban.js";
import { massbanCommand } from "./commands/massban.js";
import { purgeCommand } from "./commands/purge.js";
import { channelCommand } from "./commands/channel.js";
import { lockdownCommand } from "./commands/lockdown.js";
import { nickCommand } from "./commands/nick.js";
import { historyCommand } from "./commands/history.js";
import { modstatsCommand } from "./commands/modstats.js";
import {
  moderateUserCommand,
  moderateMessageCommand,
  reportMessageCommand,
  handleModalSubmit,
  showReasonModal,
} from "./commands/contextMenus.js";
import { client } from "../../client.js";
import { Events, ChannelType } from "discord.js";
import { prisma } from "@modest/db";
import { ModerationService } from "./service.js";
import {
  findCase,
  undoCase,
  getUserCases,
  incrementCaseCounter,
  createCase,
  applyRepPenalty,
  getActiveWarnPoints,
  getLadderCasesInWindow,
} from "./repository.js";

registerCommand(warnCommand, import.meta.url);
registerCommand(timeoutCommand, import.meta.url);
registerCommand(untimeoutCommand, import.meta.url);
registerCommand(kickCommand, import.meta.url);
registerCommand(banCommand, import.meta.url);
registerCommand(softbanCommand, import.meta.url);
registerCommand(unbanCommand, import.meta.url);
registerCommand(massbanCommand, import.meta.url);
registerCommand(purgeCommand, import.meta.url);
registerCommand(channelCommand, import.meta.url);
registerCommand(lockdownCommand, import.meta.url);
registerCommand(nickCommand, import.meta.url);
registerCommand(historyCommand, import.meta.url);
registerCommand(modstatsCommand, import.meta.url);
registerCommand(moderateUserCommand, import.meta.url);
registerCommand(moderateMessageCommand, import.meta.url);
registerCommand(reportMessageCommand, import.meta.url);

// §MOD-09 Context menu button & modal handling
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("mod:context:")) return;

  const parts = customId.split(":");
  // mod:context:<action>:<targetId>:<moderatorId>
  const action = parts[2];
  const targetId = parts[3];
  const moderatorId = parts[4];

  if (!action || !targetId || !moderatorId) return;

  // Direct delete: no modal needed
  if (action === "delete") {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "This must be used in a server.", ephemeral: true });
      return;
    }
    try {
      await interaction.channel?.messages.delete(targetId);
      await interaction.reply({ content: "Message deleted.", ephemeral: true });
    } catch {
      await interaction.reply({ content: "Failed to delete message.", ephemeral: true });
    }
    return;
  }

  // History button: show case history panel instead of a reason modal
  if (action === "history" && interaction.isButton()) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "This must be used in a server.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: guild.id },
      select: { modLogChannelId: true, logChannels: true },
    });
    const expiryDays =
      typeof (config as any)?.warn?.pointExpiryDays === "number"
        ? (config as any).warn.pointExpiryDays
        : typeof (config as any)?.pointExpiryDays === "number"
          ? (config as any).pointExpiryDays
          : 30;

    const service = new ModerationService({
      incrementCaseCounter: async () => 0,
      createCase: async () => ({ id: 0, number: 0 }),
      applyRepPenalty: async () => 0,
      getActiveWarnPoints: async () => 0,
      getLadderCasesInWindow: async () => [],
      findCase: async () => null,
      undoCase: async () => {},
      getUserCases,
    });

    const [cases, activePoints] = await Promise.all([
      service.deps.getUserCases(guild.id, targetId),
      service.deps.getActiveWarnPoints(guild.id, targetId, expiryDays),
    ]);

    const embed = {
      title: `Moderation History — <@${targetId}>`,
      description: `Active warning points: **${activePoints}**\nTotal cases: ${cases.length}`,
      color: 0x5865f2,
      timestamp: new Date().toISOString(),
      fields: [] as { name: string; value: string; inline?: boolean }[],
    };

    if (cases.length === 0) {
      embed.fields.push({
        name: "No cases",
        value: "This user has no moderation cases.",
        inline: false,
      });
    } else {
      for (const c of cases.slice(0, 20)) {
        const status = c.undone ? " ~~(undone)~~" : "";
        const pointsText = c.points > 0 ? ` +${c.points} pts` : "";
        embed.fields.push({
          name: `Case #${c.number} — ${c.type}${status}`,
          value: `**Reason:** ${c.reason}\n**Points:**${pointsText}\n**When:** <t:${Math.floor(c.createdAt.getTime() / 1000)}:R>`,
          inline: false,
        });
      }
      if (cases.length > 20) {
        embed.fields.push({
          name: `And ${cases.length - 20} more...`,
          value: "Use `/history` to view the full list.",
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (interaction.isButton()) {
    await showReasonModal(interaction, action, targetId, moderatorId);
    return;
  }

  if (interaction.isModalSubmit()) {
    const cfg = {};
    const t = (key: string) => key;
    await handleModalSubmit(interaction, cfg, t);
  }
});

// §MOD-12 Undo button handler — reverses WARN, TIMEOUT, KICK, BAN/TEMPBAN/SOFTBAN cases
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("mod:undo:")) return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This must be used in a server.", ephemeral: true });
    return;
  }

  const parts = customId.split(":");
  // mod:undo:<caseNumber>
  const caseNumber = Number.parseInt(parts[2] ?? "", 10);
  if (!caseNumber) {
    await interaction.reply({ content: "Invalid case number.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Load config for mod log channel
  const config = await prisma.guildConfig.findUnique({
    where: { guildId: guild.id },
    select: { modLogChannelId: true, logChannels: true },
  });
  const modLogChannelId =
    (config?.modLogChannelId as string | undefined) ??
    ((config?.logChannels as Record<string, string> | undefined)?.["modLog"]);

  const service = new ModerationService({
    incrementCaseCounter,
    createCase,
    applyRepPenalty,
    getActiveWarnPoints,
    getLadderCasesInWindow,
    findCase,
    undoCase,
    getUserCases,
  });

  const undone = await service.undoCase(guild.id, caseNumber, interaction.user.id);
  if (!undone) {
    await interaction.editReply({ content: "Case not found or already undone." });
    return;
  }

  // Perform type-specific Discord reversal action
  try {
    if (undone.type === "TIMEOUT") {
      const member = guild.members.cache.get(undone.targetId);
      if (member) await member.timeout(null, "Undone by moderator");
    } else if (undone.type === "BAN" || undone.type === "TEMPBAN" || undone.type === "SOFTBAN") {
      await guild.bans.remove(undone.targetId, "Undone by moderator");
    }
  } catch {
    // Discord reversal may fail (e.g. user not actually banned/timed out); DB undo still stands.
  }

  // Edit log embed (§10.4: strikethrough title + "Undone by @mod")
  const case_ = await service.deps.findCase(guild.id, caseNumber);
  if (modLogChannelId && case_?.logMessageId) {
    const channel = guild.channels.cache.get(modLogChannelId);
    if (channel && channel.type === ChannelType.GuildText) {
      try {
        const message = await channel.messages.fetch(case_!.logMessageId);
        const embed = message.embeds[0] as { title?: string; description?: string };
        if (embed) {
          const embedData = { ...embed };
          const updatedEmbed = {
            ...embedData,
            title: `~~${embedData.title ?? "Case"}~~`,
            description: embedData.description
              ? `${embedData.description}\n\n*Undone by <@${interaction.user.id}>*`
              : `*Undone by <@${interaction.user.id}>*`,
          };
          await message.edit({ embeds: [updatedEmbed] });
        }
      } catch {
        // Log message may be deleted or inaccessible; continue without failing.
      }
    }
  }

  let extraContent = "";
  if (undone.type === "KICK") {
    extraContent =
      "\n\nNote: the user cannot rejoin automatically. You may send them an invite if appropriate.";
  }

  await interaction.editReply({
    content: `Case #${caseNumber} (${undone.type}) has been undone by <@${interaction.user.id}>.${extraContent}`,
  });
});

export {
  warnCommand,
  timeoutCommand,
  untimeoutCommand,
  kickCommand,
  banCommand,
  softbanCommand,
  unbanCommand,
  massbanCommand,
  purgeCommand,
  channelCommand,
  lockdownCommand,
  nickCommand,
  moderateUserCommand,
  moderateMessageCommand,
  reportMessageCommand,
};
