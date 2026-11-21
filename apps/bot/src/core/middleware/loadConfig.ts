import { prisma } from "@modest/db";

export async function loadConfig(
  guildId: string,
): Promise<{ guildId: string; modules: Record<string, boolean> }> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { modules: true },
  });

  const modules = config?.modules
    ? (config.modules as Record<string, boolean>)
    : {};

  return { guildId, modules };
}
