import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";
import { AutomodRepository } from "../repository.js";
import { AutomodService, type AutomodConfig } from "../service.js";

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

export const simulateCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("simulate")
    .setDescription("Simulate AutoMod pipeline against recent channel messages (no action taken).")
    .setDescriptionLocalizations(localizationsFor("automod:simulate"))
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Number of recent messages to scan (max 1000)")
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false),
    ),
  module: "automod",
  staffLevel: "moderator",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;

    if (!guildId) {
      await ctx.error(t("automod:error:notInServer"));
      return;
    }

    const limit = Math.min(interaction.options.getInteger("limit") ?? 100, 1000);

    const channel = interaction.channel;
    if (!channel?.isTextBased()) {
      await ctx.error(t("automod:error:notInTextChannel"));
      return;
    }

    // Fetch recent messages (memory-only simulation; no Discord action taken).
    const messages = await (channel as any).messages.fetch({ limit });

    const repo = new AutomodRepository({ redisUrl: process.env["REDIS_URL"] ?? "" });
    const service = new AutomodService(
      AutomodRepository.createServiceDeps(repo),
      {
        firstAction: getCfg(cfg, "automod.firstAction", "delete") as AutomodConfig["firstAction"],
        timeoutSec: getCfg(cfg, "automod.timeoutSec", 600) as number,
        spamMaxMessages: getCfg(cfg, "automod.spamMaxMessages", 5) as number,
        spamWindowSec: getCfg(cfg, "automod.spamWindowSec", 10) as number,
        duplicateMaxRepeats: getCfg(cfg, "automod.duplicateMaxRepeats", 3) as number,
        mentionsMaxPerMessage: getCfg(cfg, "automod.mentionsMaxPerMessage", 5) as number,
        mentionsMaxRolePerMessage: getCfg(cfg, "automod.mentionsMaxRolePerMessage", 3) as number,
        emojiMaxPerMessage: getCfg(cfg, "automod.emojiMaxPerMessage", 10) as number,
        capsMaxPercent: getCfg(cfg, "automod.capsMaxPercent", 70) as number,
        newlinesMax: getCfg(cfg, "automod.newlinesMax", 10) as number,
        zalgoEnabled: getCfg(cfg, "automod.zalgoEnabled", true) as boolean,
        badWordsLevel: getCfg(cfg, "automod.badWordsLevel", "standard") as AutomodConfig["badWordsLevel"],
        linksMode: getCfg(cfg, "automod.linksMode", "allowlist") as AutomodConfig["linksMode"],
        invitesMode: getCfg(cfg, "automod.invitesMode", "block") as AutomodConfig["invitesMode"],
        phishingEnabled: getCfg(cfg, "automod.phishingEnabled", true) as boolean,
        publicNotice: false,
        useNative: false,
        aiEnabled: false,
        mediaScanEnabled: false,
      },
    );

    const mappedMessages = messages.map((m: any) => ({
      messageId: m.id,
      userId: m.author.id,
      channelId: m.channel.id,
      content: m.content ?? "",
      attachments: Array.from(m.attachments.values()).map((a: any) => ({
        filename: a.name,
        size: a.size,
        contentType: a.contentType ?? undefined,
      })),
      channelIsNsfw: channel.isNSFW(),
      isBot: m.author.bot ?? false,
      isStaff: false, // simulation assumes non-staff unless server wiring is added later
      memberRoles: m.member?.roles.cache.map((r: any) => r.id) ?? [],
      embedUrls: m.embeds.map((e: any) => e.url ?? "").filter(Boolean),
      mentionUserIds: Array.from(m.mentions.users.keys()),
      mentionRoleIds: Array.from(m.mentions.roles.keys()),
      mentionEveryone: m.mentions.everyone ?? false,
      mentionHere: false,
      timestamp: m.createdAt,
      replyChainPriorHits: false,
    }));

    const result = await service.simulatePipeline(mappedMessages, guildId);

    const embed = new EmbedBuilder()
      .setTitle(t("automod:simulate:title"))
      .setColor(COLORS.moderation.warn)
      .addFields(
        {
          name: t("automod:simulate:field.scanned"),
          value: String(result.totalMessages),
          inline: true,
        },
        {
          name: t("automod:simulate:field.wouldAction"),
          value: String(result.wouldActionCount),
          inline: true,
        },
        {
          name: t("automod:simulate:field.wouldDelete"),
          value: String(result.wouldDeleteCount),
          inline: true,
        },
        {
          name: t("automod:simulate:field.affectedUsers"),
          value: String(result.affectedUsers.size),
          inline: true,
        },
      )
      .setTimestamp();

    if (result.wouldActionCount > 0) {
      const examples = result.hits.slice(0, 5).map((h) =>
        `${t("automod:simulate:example.label", { rule: h.ruleKey, action: h.action, reason: h.reason })} <@${h.userId}> (would ${h.wouldDelete ? t("automod:simulate:example.delete") : t("automod:simulate:example.action")})`,
      );
      embed.addFields({
        name: t("automod:simulate:field.examples"),
        value: examples.join("\n") || t("automod:simulate:example.none"),
        inline: false,
      });
    } else {
      embed.addFields({
        name: t("automod:simulate:field.examples"),
        value: t("automod:simulate:example.none"),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
  },
};
