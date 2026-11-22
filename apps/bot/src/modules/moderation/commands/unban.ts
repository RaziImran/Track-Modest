import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { validateUnBanInput } from "../schemas.js";
import { ModerationService } from "../service.js";
import {
  createCase,
  incrementCaseCounter,
} from "../repository.js";
import { encodeId } from "../../../core/componentIds.js";

export const unbanCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server.")
    .setDescriptionLocalizations(localizationsFor("unban"))
    .addStringOption((opt) =>
      opt
        .setName("user")
        .setDescription("User ID to unban (autocomplete from ban list)")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the unban")
        .setRequired(true),
    ),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  autocomplete: async (ctx: unknown) => {
    const interaction = (ctx as { interaction: any }).interaction as any;
    const focused = interaction.options.getFocused() as { name: string; value: string | undefined };
    if (focused.name !== "user") return;
    const guild = interaction.guild;
    if (!guild) return;
    const bans = await guild.bans.fetch();
    const query = (focused.value ?? "").toString().toLowerCase();
    const filtered = bans
      .filter((b: any) => b.user.username.toLowerCase().includes(query) || b.user.id.includes(query))
      .slice(0, 25);
    await interaction.respond(filtered.map((b: any) => ({ name: `${b.user.username} (${b.user.id})`, value: b.user.id })));
  },
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";

    const targetId = interaction.options.getString("user", true);
    const reason = interaction.options.getString("reason", true);

    const parsed = validateUnBanInput({ user: targetId, reason });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: cleanUser, reason: cleanReason } = parsed;

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:unban:error.notInServer"));
      return;
    }

    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty: async () => 0,
      getActiveWarnPoints: async () => 0,
      getLadderCasesInWindow: async () => [],
    });

    const caseNumber = await service.deps.incrementCaseCounter(guildId);

    try {
      await guild.bans.remove(cleanUser, cleanReason);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 50013
          ? ctx.t("moderation:unban:error.missingPermissions")
          : ctx.t("moderation:unban:error.actionFailed");
      await ctx.error(message);
      return;
    }

    const created = await service.deps.createCase({
      guildId,
      type: "UNBAN",
      targetId: cleanUser,
      moderatorId: interaction.user.id,
      reason: cleanReason,
      points: 0,
      caseNumber,
      automatic: false,
    });

    const message = ctx.t("moderation:unban:success", {
      caseNumber,
      caseId: created.id,
      user: `<@${cleanUser}>`,
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "unban", "view", String(caseNumber)))
        .setLabel("View case")
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: message, ephemeral: true, components: [row], allowedMentions: { parse: [] } });
  },
};
