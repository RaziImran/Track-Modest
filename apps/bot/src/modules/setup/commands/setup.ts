import {
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import {
  setSetupState,
  deleteSetupState,
} from "../repository.js";
import { COLORS } from "../../../core/reply.js";
import { initialSetupState } from "../schemas.js";

const SETUP_STATE_TTL_SEC = 60 * 30; // 30 minutes

export const setupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Run the server setup wizard to configure Track Modest.")
    .setDescriptionLocalizations(localizationsFor("setup")),
  module: "setup",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("setup:error.notInServer"));
      return;
    }

    const userId = interaction.user.id;

    await deleteSetupState(guild.id, userId);
    await setSetupState(
      guild.id,
      userId,
      initialSetupState(),
      SETUP_STATE_TTL_SEC,
    );

    await sendStep1(ctx, guild);
  },
};

async function sendStep1(
  ctx: CommandContext,
  guild: any,
): Promise<void> {
  const interaction = ctx.interaction as any;
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;

  const embed = new EmbedBuilder()
    .setTitle(t("setup:step1.title"))
    .setDescription(t("setup:step1.description"))
    .setColor(COLORS.info)
    .addFields({
      name: t("setup:step1.field.current"),
      value: guild.preferredLocale ?? t("setup:step1.field.default"),
    });

  const row = [
    new ButtonBuilder()
      .setCustomId("setup:next:1")
      .setLabel(t("setup:button.next"))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("setup:skip:1")
      .setLabel(t("setup:button.skip"))
      .setStyle(ButtonStyle.Secondary),
  ];

  await interaction.reply({
    embeds: [embed],
    components: [{ type: 1, components: row }],
    ephemeral: true,
  });
}
