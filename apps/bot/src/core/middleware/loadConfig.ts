export async function loadConfig(
  guildId: string,
): Promise<{ guildId: string; modules: Record<string, boolean> }> {
  return { guildId, modules: {} };
}
