// Logging service (§13.1).
// Pure logic: NO discord.js imports. All I/O and Discord types live in the
// event handlers and embeds module so this file stays unit-testable.

import type { GuildLoggingConfig } from "./repository.js";
import type { LoggingConfig } from "./schemas.js";

export const LOG_COLORS = {
  BRAND: 0x7c5cff,
  SUCCESS: 0x3ba55d,
  DANGER: 0xed4245,
  WARNING: 0xfaa61a,
  INFO: 0x5865f2,
} as const;

export const LOG_CATEGORY_COLORS: Record<string, number> = {
  messages: LOG_COLORS.INFO,
  members: LOG_COLORS.BRAND,
  roles: LOG_COLORS.WARNING,
  channels: LOG_COLORS.SUCCESS,
  voice: LOG_COLORS.BRAND,
  moderation: LOG_COLORS.DANGER,
  automod: LOG_COLORS.DANGER,
  invites: LOG_COLORS.INFO,
  server: LOG_COLORS.WARNING,
} as const;

export function getCategoryColor(category: string): number {
  return LOG_CATEGORY_COLORS[category] ?? LOG_COLORS.INFO;
}

export interface EditLogData {
  guildId: string;
  channelId: string;
  authorId: string;
  authorTag: string;
  authorAvatarUrl: string | null;
  beforeContent: string | null;
  afterContent: string | null;
  beforeAttachments: string[];
  afterAttachments: string[];
  messageUrl: string;
  timestamp: number;
}

export interface DeleteLogData {
  guildId: string;
  channelId: string;
  authorId: string;
  authorTag: string;
  authorAvatarUrl: string | null;
  content: string | null;
  attachments: Array<{ name: string; url: string; size: number }>;
  messageUrl: string;
  timestamp: number;
  wasCached: boolean;
}

export interface BulkDeleteLogData {
  guildId: string;
  channelId: string;
  messageCount: number;
  messages: Array<{
    authorId: string;
    authorTag: string;
    content: string | null;
    attachments: Array<{ name: string; url: string; size: number }>;
    timestamp: number;
  }>;
  timestamp: number;
}

export function formatContent(content: string | null, maxLength: number = 1024): string {
  if (!content) return "*(no text content)*";
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 3) + "...";
}

export function formatAttachments(
  attachments: Array<{ name: string; url: string; size: number }>,
): string {
  if (attachments.length === 0) return "*(none)*";
  return attachments
    .map((a) => `[${a.name}](${a.url}) (${formatBytes(a.size)})`)
    .join("\n");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return Number.isInteger(kb) ? `${kb}KB` : `${kb.toFixed(1)}KB`;
  }
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}

export function resolveLogChannel(
  guildConfig: GuildLoggingConfig,
  category: string,
): string | null {
  if (!shouldLogCategory(guildConfig, category)) return null;
  const channels = guildConfig.logChannels as Record<string, string>;
  return channels[category] ?? null;
}

export function shouldIgnore(
  guildConfig: GuildLoggingConfig,
  channelId: string,
  _authorId: string,
  authorRoles: string[],
  isBot: boolean,
): boolean {
  if (isBot) return true;
  if (isIgnoredChannel(guildConfig, channelId)) return true;
  if (isIgnoredRole(guildConfig, authorRoles)) return true;
  return false;
}

export function isIgnoredChannel(guildConfig: GuildLoggingConfig, channelId: string): boolean {
  const loggingConfig = getLoggingConfig(guildConfig.overrides);
  return loggingConfig.ignoredChannels.includes(channelId);
}

export function isIgnoredRole(guildConfig: GuildLoggingConfig, roleIds: string[]): boolean {
  const loggingConfig = getLoggingConfig(guildConfig.overrides);
  return roleIds.some((roleId) => loggingConfig.ignoredRoles.includes(roleId));
}

export function getLoggingConfig(overrides: Record<string, unknown>): LoggingConfig {
  const logging = (overrides?.["logging"] as Record<string, unknown>) ?? {};
  return {
    verbosity: (logging["verbosity"] as "all" | "important") ?? "all",
    ignoredChannels: (logging["ignoredChannels"] as string[]) ?? [],
    ignoredRoles: (logging["ignoredRoles"] as string[]) ?? [],
    ghostPingNotify: (logging["ghostPingNotify"] as boolean) ?? false,
  };
}

export function shouldLogCategory(guildConfig: GuildLoggingConfig, category: string): boolean {
  const modules = guildConfig.modules as Record<string, boolean>;
  if (modules["logging"] === false) return false;
  const channels = guildConfig.logChannels as Record<string, string>;
  if (!channels[category]) return false;
  return true;
}

export function getGhostPingNotify(guildConfig: GuildLoggingConfig): boolean {
  const loggingConfig = getLoggingConfig(guildConfig.overrides);
  return loggingConfig.ghostPingNotify;
}

export function getVerbosity(guildConfig: GuildLoggingConfig): "all" | "important" {
  const loggingConfig = getLoggingConfig(guildConfig.overrides);
  return loggingConfig.verbosity;
}

export function extractMessageData(message: { content: string | null; attachments: Array<{ name: string; url: string; size: number }> | Map<string, { name: string; url: string; size: number }> }, _wasCached: boolean = true): {
  content: string | null;
  attachments: Array<{ name: string; url: string; size: number }>;
} {
  const content = message.content || null;
  const attachmentList = Array.isArray(message.attachments)
    ? message.attachments
    : Array.from(message.attachments.values());
  const attachments = attachmentList.map((a) => ({
    name: a.name,
    url: a.url,
    size: a.size,
  }));

  return { content, attachments };
}

export function getMessageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
