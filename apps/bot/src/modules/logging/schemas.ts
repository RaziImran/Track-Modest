import { z } from "zod";

export const LoggingCategorySchema = z.enum([
  "messages",
  "members",
  "roles",
  "channels",
  "voice",
  "moderation",
  "automod",
  "invites",
  "server",
]);

export type LoggingCategory = z.infer<typeof LoggingCategorySchema>;

export const LogChannelsSchema = z.record(LoggingCategorySchema, z.string());
export type LogChannels = z.infer<typeof LogChannelsSchema>;

export const LoggingIgnoredChannelsSchema = z.array(z.string());
export type LoggingIgnoredChannels = z.infer<typeof LoggingIgnoredChannelsSchema>;

export const LoggingIgnoredRolesSchema = z.array(z.string());
export type LoggingIgnoredRoles = z.infer<typeof LoggingIgnoredRolesSchema>;

export const LoggingConfigSchema = z.object({
  verbosity: z.enum(["all", "important"]).default("all"),
  ignoredChannels: LoggingIgnoredChannelsSchema.default([]),
  ignoredRoles: LoggingIgnoredRolesSchema.default([]),
  ghostPingNotify: z.boolean().default(false),
  webhookEnabled: z.boolean().default(false),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

export function validateLogChannel(raw: unknown): { channelId: string } | { error: string } {
  const r = raw as Record<string, unknown>;
  const channelId = typeof r["channelId"] === "string" ? r["channelId"] : "";
  if (!channelId) return { error: "Channel ID is required" };
  return { channelId };
}

export function validateIgnoreChannel(raw: unknown): { channelId: string } | { error: string } {
  const r = raw as Record<string, unknown>;
  const channelId = typeof r["channelId"] === "string" ? r["channelId"] : "";
  if (!channelId) return { error: "Channel ID is required" };
  return { channelId };
}

export function validateIgnoreRole(raw: unknown): { roleId: string } | { error: string } {
  const r = raw as Record<string, unknown>;
  const roleId = typeof r["roleId"] === "string" ? r["roleId"] : "";
  if (!roleId) return { error: "Role ID is required" };
  return { roleId };
}

export function validateGhostPingNotify(raw: unknown): { enabled: boolean } | { error: string } {
  const r = raw as Record<string, unknown>;
  const enabled = typeof r["enabled"] === "boolean" ? r["enabled"] : false;
  return { enabled };
}