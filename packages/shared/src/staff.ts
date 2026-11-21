export type StaffLevel = "none" | "helper" | "moderator" | "admin" | "owner";

export const STAFF_LEVEL_ORDER: readonly StaffLevel[] = ["none", "helper", "moderator", "admin", "owner"];

export function staffLevelIndex(level: StaffLevel): number {
  return STAFF_LEVEL_ORDER.indexOf(level);
}

export function levelName(level: StaffLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

// §6.4 Hierarchy rule
// Returns null if the action is allowed, or a human-readable reason string if refused.
export function checkHierarchy({
  targetIsGuildOwner,
  targetIsSelf,
  targetHighestRoleGeActor,
  targetHighestRoleGeBot,
  actorIsOwner,
}: {
  targetIsGuildOwner: boolean;
  targetIsSelf: boolean;
  targetHighestRoleGeActor: boolean;
  targetHighestRoleGeBot: boolean;
  actorIsOwner: boolean;
}): string | null {
  // (a) target is the guild owner
  if (targetIsGuildOwner && !actorIsOwner) {
    return "Cannot moderate the server owner.";
  }
  // (b) target is the moderator themself
  if (targetIsSelf) {
    return "Cannot moderate yourself.";
  }
  // (c) target's highest role >= moderator's highest role (unless moderator is owner)
  if (!actorIsOwner && targetHighestRoleGeActor) {
    return "Target has a role equal to or higher than yours. Move your role above theirs in Server Settings → Roles.";
  }
  // (d) target's highest role >= bot's highest role
  if (targetHighestRoleGeBot) {
    return "Target has a role equal to or higher than mine. Move my role above theirs in Server Settings → Roles.";
  }
  return null;
}

export function levelSatisfies(required: StaffLevel, actual: StaffLevel): boolean {
  return staffLevelIndex(actual) >= staffLevelIndex(required);
}
