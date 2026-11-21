import { prisma } from "@modest/db";
import type { LogChannels } from "./schemas.js";

export interface GuildLoggingConfig {
  guildId: string;
  modules: Record<string, boolean>;
  logChannels: LogChannels;
  overrides: Record<string, unknown>;
  sizeTier: string;
}

export async function getGuildLoggingConfig(guildId: string): Promise<GuildLoggingConfig | null> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: {
      guildId: true,
      modules: true,
      logChannels: true,
      overrides: true,
      sizeTier: true,
    },
  });

  if (!config) return null;

  return {
    guildId: config.guildId,
    modules: config.modules as Record<string, boolean>,
    logChannels: config.logChannels as LogChannels,
    overrides: config.overrides as Record<string, unknown>,
    sizeTier: config.sizeTier,
  };
}

export async function getLogChannel(guildId: string, category: string): Promise<string | null> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { logChannels: true, modules: true },
  });

  if (!config) return null;
  const modules = config.modules as Record<string, boolean> | null;
  if (modules?.["logging"] === false) return null;

  const channels = config.logChannels as Record<string, string>;
  return channels[category] ?? null;
}