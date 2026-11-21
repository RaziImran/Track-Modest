export async function guildOnly(interaction: { isInGuild?: () => boolean }): Promise<void> {
  if (!interaction.isInGuild?.()) {
    throw new Error("This command can only be used in a server.");
  }
}
