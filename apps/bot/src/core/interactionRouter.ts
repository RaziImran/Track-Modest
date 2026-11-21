import type { ChatInputCommandInteraction, ContextMenuCommandInteraction } from "discord.js";
import { getCommand, clearCommands } from "./commandRegistry.js";

export interface RouterOptions {
  onError: (err: unknown, interaction: unknown) => void;
}

export function createInteractionRouter(options: RouterOptions) {
  async function handleChatInput(interaction: ChatInputCommandInteraction): Promise<void> {
    const entry = getCommand(interaction.commandName);
    if (!entry) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }
    try {
      await entry.command.execute({
        interaction,
        config: {},
        staffLevel: "none",
        t: (key: string) => key,
        success: async (msg: string) => await interaction.reply({ content: msg, ephemeral: true }),
        error: async (msg: string) => await interaction.reply({ content: msg, ephemeral: true }),
        confirm: async () => false,
      } as never);
    } catch (err) {
      options.onError(err, interaction);
    }
  }

  async function handleContextMenu(interaction: ContextMenuCommandInteraction): Promise<void> {
    const entry = getCommand(interaction.commandName);
    if (!entry) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }
    try {
      await entry.command.execute({
        interaction,
        config: {},
        staffLevel: "none",
        t: (key: string) => key,
        success: async (msg: string) => await interaction.reply({ content: msg, ephemeral: true }),
        error: async (msg: string) => await interaction.reply({ content: msg, ephemeral: true }),
        confirm: async () => false,
      } as never);
    } catch (err) {
      options.onError(err, interaction);
    }
  }

  return {
    handleChatInput,
    handleContextMenu,
    clear: () => clearCommands(),
  };
}
