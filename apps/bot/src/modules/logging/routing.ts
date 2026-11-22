import type { GuildLoggingConfig } from "./repository.js";

export const LOG_CATEGORIES = [
  "messages","members","roles","channels","voice","moderation","automod","invites","server",
] as const;

export function routeCategory(guildConfig: GuildLoggingConfig, category: string): string | null {
  const channels = guildConfig.logChannels as Record<string, string>;
  return channels?.[category] ?? null;
}
