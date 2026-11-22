// §12.1 Anti-raid join-spike detection — pure service layer (no discord.js imports).
import type { GuildMember } from "discord.js";

/** Suspicion signals per joining account (spec §12.1). */
export interface SuspicionSignals {
  accountAgeDays: number;
  hasDefaultAvatar: boolean;
  usernameSimilarToRecentJoiners: boolean;
  createdWithin10MinOfOthers: boolean;
}

export function computeSuspicionScore(signals: SuspicionSignals): number {
  let score = 0;
  if (signals.accountAgeDays < 1) score += 3;
  else if (signals.accountAgeDays < 7) score += 2;
  if (signals.hasDefaultAvatar) score += 1;
  if (signals.usernameSimilarToRecentJoiners) score += 3;
  if (signals.createdWithin10MinOfOthers) score += 3;
  return score;
}

export interface RaidConfig {
  raidWindowSec: number;
  raidMinJoins: number;
  raidJoinMultiplier: number;
  raidAction: "alert" | "lock_and_alert" | "lock_kick_new";
  raidPingMods: boolean;
}

export function getRaidThreshold(
  cfg: RaidConfig,
  baseline: number,
): number {
  const multiplied = baseline * cfg.raidJoinMultiplier;
  return Math.max(cfg.raidMinJoins, multiplied);
}

export function isRaid(
  joinsInWindow: number,
  threshold: number,
): boolean {
  return joinsInWindow >= threshold;
}

export function getDefaultAvatar(member: GuildMember): boolean {
  return member.user.displayAvatarURL().includes("default avatar");
}

export function accountAgeDays(member: GuildMember): number {
  return (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
}
