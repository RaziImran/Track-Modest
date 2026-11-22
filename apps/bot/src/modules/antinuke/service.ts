// §12.3 Anti-nuke — pure service layer (no discord.js imports).
import type { Role } from "discord.js";

export type NukeActionGroup =
  | "channel_delete"
  | "role_delete"
  | "member_ban"
  | "member_kick"
  | "webhook_create"
  | "role_update_dangerous"
  | "bot_add"
  | "guild_update_vanity";

export interface NukeConfig {
  threshold: number;
  trustedUsers: string[];
}

export interface AntiNukeEvent {
  guildId: string;
  executorId: string;
  actionGroup: NukeActionGroup;
  targetId: string | null;
  extra: string | null;
}

export function parseAuditLogAction(
  action: string,
  extra: Record<string, unknown> | null,
): NukeActionGroup | null {
  switch (action) {
    case "CHANNEL_DELETE":
      return "channel_delete";
    case "ROLE_DELETE":
      return "role_delete";
    case "MEMBER_BAN_ADD":
      return "member_ban";
    case "MEMBER_KICK":
      return "member_kick";
    case "WEBHOOK_CREATE":
      return "webhook_create";
    case "ROLE_UPDATE": {
      // Only treat as destructive when adding Administrator/Ban Members/Manage Guild
      if (extra?.["addedPermissions"]) {
        const perms = extra["addedPermissions"] as string[];
        if (
          perms.includes("Administrator") ||
          perms.includes("BanMembers") ||
          perms.includes("ManageGuild")
        ) {
          return "role_update_dangerous";
        }
      }
      return null;
    }
    case "BOT_ADD":
      return "bot_add";
    case "GUILD_UPDATE": {
      if (extra?.["changed"]) {
        const changed = extra["changed"] as string[];
        if (changed.includes("vanity_url") || changed.includes("vanityURL")) {
          return "guild_update_vanity";
        }
      }
      return null;
    }
    default:
      return null;
  }
}

export function parseConfig(overrides: Record<string, unknown> | undefined): NukeConfig {
  const threshold =
    typeof overrides?.["antinuke.threshold"] === "number"
      ? (overrides["antinuke.threshold"] as number)
      : 5;
  const trustedUsers =
    Array.isArray(overrides?.["antinuke.trustedUsers"])
      ? (overrides["antinuke.trustedUsers"] as string[])
      : [];
  return { threshold, trustedUsers };
}

export function isWhitelisted(executorId: string, ownerId: string, trustedUsers: string[]): boolean {
  if (executorId === ownerId) return true;
  return trustedUsers.includes(executorId);
}

export function shouldAct(
  count: number,
  threshold: number,
  isOwner: boolean,
  isTrusted: boolean,
): boolean {
  if (isOwner || isTrusted) return false;
  return count > threshold;
}

export function dangerousRolePermissions(role: Role): string[] {
  const perms: string[] = [];
  const p = role.permissions;
  if (p.has("Administrator")) perms.push("Administrator");
  if (p.has("BanMembers")) perms.push("BanMembers");
  if (p.has("KickMembers")) perms.push("KickMembers");
  if (p.has("ManageGuild")) perms.push("ManageGuild");
  if (p.has("ManageRoles")) perms.push("ManageRoles");
  if (p.has("ManageWebhooks")) perms.push("ManageWebhooks");
  return perms;
}

export function isDangerousRole(role: Role): boolean {
  return dangerousRolePermissions(role).length > 0;
}
