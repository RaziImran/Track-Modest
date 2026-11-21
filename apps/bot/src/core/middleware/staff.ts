import type { GuildMember } from "discord.js";
import type { StaffLevel } from "@modest/shared";
import { staffLevelIndex, levelSatisfies } from "@modest/shared";

export const STAFF_LEVELS: StaffLevel[] = ["none", "helper", "moderator", "admin", "owner"];

export interface StaffContext {
  level: StaffLevel;
  isOwner: boolean;
  roles: string[];
}

export function resolveStaffLevel(
  member: GuildMember | null,
  configStaffRoles: Record<string, string[]>,
  guildOwnerId: string,
): StaffContext {
  if (!member) return { level: "none", isOwner: false, roles: [] };

  const userId = member.id;
  const isOwner = userId === guildOwnerId;
  if (isOwner) return { level: "owner", isOwner: true, roles: member.roles.cache.map((r) => r.id) };

  const roleIds = member.roles.cache.map((r) => r.id);
  let best: StaffLevel = "none";

  for (const [level, roleIdsForLevel] of Object.entries(configStaffRoles)) {
    const lvl = level as StaffLevel;
    if (!STAFF_LEVELS.includes(lvl)) continue;
    for (const roleId of roleIdsForLevel as string[]) {
      if (roleIds.includes(roleId)) {
        if (staffLevelIndex(lvl) > staffLevelIndex(best)) {
          best = lvl;
        }
        break;
      }
    }
  }

  return { level: best, isOwner: false, roles: roleIds };
}

export function requireStaffLevel(required: StaffLevel, ctx: StaffContext): string | null {
  if (!levelSatisfies(required, ctx.level)) {
    return `This command requires staff level ${ctx.level.charAt(0).toUpperCase() + ctx.level.slice(1)} or higher.`;
  }
  return null;
}
