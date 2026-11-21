import { SlashCommandBuilder } from "discord.js";
import type { BotCommand, CommandContext } from "@modest/shared";

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is responsive."),
  module: "core",
  staffLevel: "none",
  async execute(ctx: CommandContext): Promise<void> {
    await ctx.success("Pong! Bot is online.");
  },
};
