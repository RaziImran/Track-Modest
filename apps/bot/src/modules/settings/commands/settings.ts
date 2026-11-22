import {
  EmbedBuilder,
  SelectMenuBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import {
  type SettingsCategory,
  CATEGORY_LABELS,
} from "../schemas.js";
import { COLORS } from "../../../core/reply.js";

const CATEGORIES: SettingsCategory[] = [
  "General",
  "Protection",
  "AutoMod",
  "Logging",
  "Welcome",
  "Roles",
  "Reputation",
  "XP",
  "Nova",
  "Economy & Games",
  "Tickets",
  "Advanced",
];

export const settingsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure server settings via an interactive panel.")
    .setDescriptionLocalizations(localizationsFor("settings"))
    .addSubcommand((sub) =>
      sub.setName("history").setDescription("View recent config change history."),
    ),
  module: "config",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("settings:error.notInServer"));
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "history") {
      await sendHistory(ctx);
      return;
    }

    await sendPanel(ctx);
  },
};

async function sendPanel(
  ctx: CommandContext,
): Promise<void> {
  const interaction = ctx.interaction as any;
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;

  const embed = new EmbedBuilder()
    .setTitle(t("settings:panel.title"))
    .setDescription(t("settings:panel.description"))
    .setColor(COLORS.info);

  const options = CATEGORIES.map((cat) => ({
    label: CATEGORY_LABELS[cat],
    value: cat,
  }));

  const select = new SelectMenuBuilder()
    .setCustomId("settings:category")
    .setPlaceholder(t("settings:panel.selectCategory"))
    .addOptions(options);

  await interaction.reply({
    embeds: [embed],
    components: [{ type: 1, components: [select] }],
    ephemeral: true,
  });
}

async function sendHistory(
  ctx: CommandContext,
): Promise<void> {
  const interaction = ctx.interaction as any;
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const guildId = interaction.guildId ?? "";

  const { getConfigHistory } = await import("../repository.js");
  const rows = await getConfigHistory(guildId, 10);

  const embed = new EmbedBuilder()
    .setTitle(t("settings:history.title"))
    .setColor(COLORS.info);

  if (rows.length === 0) {
    embed.setDescription(t("settings:history.empty"));
  } else {
    const lines = rows.map((row) => {
      const time = `<t:${Math.floor(row.createdAt.getTime() / 1000)}:R>`;
      const actor = `<@${row.actorId}>`;
      const source = row.source;
      const path = row.path;
      return `${time} ${actor} (${source}): \`${path}\``;
    });
    embed.setDescription(lines.join("\n"));
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
