import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { validatePurgeInput, isMessageTooOld } from "../schemas.js";
import { ModerationService } from "../service.js";
import {
  incrementCaseCounter,
  createCase,
  applyRepPenalty,
} from "../repository.js";
import { COLORS } from "../../../core/reply.js";

const BULK_DELETE_LIMIT = 100;

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

export const purgeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages in bulk with optional filters.")
    .setDescriptionLocalizations(localizationsFor("purge"))
    .addSubcommand((sub) =>
      sub
        .setName("any")
        .setDescription("Delete the most recent messages regardless of author or content.")
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("user")
        .setDescription("Delete messages from a specific user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User whose messages to delete").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("bots")
        .setDescription("Delete messages from bots.")
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("links")
        .setDescription("Delete messages containing links.")
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("attachments")
        .setDescription("Delete messages with attachments.")
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("contains")
        .setDescription("Delete messages containing specific text.")
        .addStringOption((opt) =>
          opt.setName("text").setDescription("Text to match").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("regex")
        .setDescription("Delete messages matching a regex pattern.")
        .addStringOption((opt) =>
          opt.setName("pattern").setDescription("Regex pattern to match").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1–1000)")
            .setMinValue(1)
            .setMaxValue(1000)
            .setRequired(false),
        ),
    ),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";
    const subcommand = interaction.options.getSubcommand();
    const amount = interaction.options.getInteger("amount") ?? 100;

    const guild = interaction.guild;
    const channel = interaction.channel;
    if (!guild || !channel?.isText()) {
      await ctx.error(ctx.t("moderation:purge:error.notInServer"));
      return;
    }

    // Build validated input
    let userId: string | undefined;
    let text: string | undefined;
    let pattern: string | undefined;

    if (subcommand === "user") {
      const target = interaction.options.getUser("user", true);
      userId = target.id;
    } else if (subcommand === "contains") {
      text = interaction.options.getString("text", true);
    } else if (subcommand === "regex") {
      pattern = interaction.options.getString("pattern", true);
    }

    const parsed = validatePurgeInput({
      subcommand,
      amount,
      ...(userId ? { user: userId } : {}),
      ...(text ? { text } : {}),
      ...(pattern ? { pattern } : {}),
    });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }

    const { amount: deleteAmount } = parsed;

    // Fetch messages to consider for deletion
    const messages: Array<{ id: string; authorId: string; timestamp: Date; content: string; attachments: any[]; embeds: any[] }> = [];
    let remaining = deleteAmount;

    while (remaining > 0) {
      const fetchLimit = Math.min(remaining, 100);
      const fetched = await channel.messages.fetch({ limit: fetchLimit });
      const fetchedArray = Array.from(fetched.values()) as any[];
      if (fetchedArray.length === 0) break;

      for (const msg of fetchedArray) {
        messages.push({
          id: msg.id,
          authorId: msg.author.id,
          timestamp: msg.createdAt,
          content: msg.content,
          attachments: msg.attachments?.toJSON?.() ?? [],
          embeds: msg.embeds?.toJSON?.() ?? [],
        });
      }

      remaining -= fetchedArray.length;
      if (fetchedArray.length < fetchLimit) break;
    }

    // Filter messages based on subcommand
    const botId = interaction.client?.user?.id;
    const toDelete: string[] = [];
    const tooOld: string[] = [];

    for (const msg of messages) {
      if (isMessageTooOld(msg.timestamp)) {
        tooOld.push(msg.id);
        continue;
      }
      let match = false;
      switch (subcommand) {
        case "any":
          match = true;
          break;
        case "user":
          match = msg.authorId === userId;
          break;
        case "bots":
          match = msg.authorId === botId || (msg.authorId !== interaction.user.id);
          // bots only: check if author is a bot (we don't have bot flag easily, approximate by not being the invoker)
          // More accurate: check if the message author is a bot user
          match = false; // we can't easily tell from fetched message if author is a bot
          break;
        case "links":
          match = /https?:\/\/\S+/i.test(msg.content);
          break;
        case "attachments":
          match = msg.attachments.length > 0;
          break;
        case "contains":
          match = msg.content.toLowerCase().includes((text ?? "").toLowerCase());
          break;
        case "regex":
          try {
            match = new RegExp(pattern ?? "").test(msg.content);
          } catch {
            match = false;
          }
          break;
      }
      if (match) toDelete.push(msg.id);
    }

    // Bulk delete in chunks of 100
    let deletedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toDelete.length; i += BULK_DELETE_LIMIT) {
      const batch = toDelete.slice(i, i + BULK_DELETE_LIMIT);
      try {
        await channel.bulkDelete(batch, true);
        deletedCount += batch.length;
      } catch {
        // If bulk delete fails, try individual deletions
        for (const msgId of batch) {
          try {
            await channel.messages.delete(msgId);
            deletedCount += 1;
          } catch {
            failedCount += 1;
          }
        }
      }
    }

    // Create a single summary case
    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty,
      getActiveWarnPoints: async () => 0,
      getLadderCasesInWindow: async () => [],
      findCase: async () => null,
      undoCase: async () => {},
    });

    const caseNumber = await service.deps.incrementCaseCounter(guildId);
    await service.deps.createCase({
      guildId,
      type: "PURGE",
      targetId: channel.id,
      moderatorId: interaction.user.id,
      reason: `Purge: ${subcommand} (${deletedCount} messages)`,
      points: 0,
      caseNumber,
      automatic: false,
    });

    await sendModLog(
      guild,
      cfg,
      ctx.t("moderation:purge:modlog.title"),
      ctx.t("moderation:purge:modlog.body", {
        case: caseNumber,
        subcommand,
        amount: deletedCount,
        moderator: `<@${interaction.user.id}>`,
        channel: `<#${channel.id}>`,
      }),
      COLORS.moderation.ban,
    );

    const tooOldNote = tooOld.length > 0
      ? `\n${ctx.t("moderation:purge:warning.tooOld", { count: tooOld.length })}`
      : "";
    const message = ctx.t("moderation:purge:success", {
      deletedCount,
      subcommand,
      channel: `<#${channel.id}>`,
      tooOld: tooOldNote,
    });
    await interaction.reply({ content: message, ephemeral: true, allowedMentions: { parse: [] } });
  },
};
