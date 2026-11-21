// Adaptive size suggestions (§8.8).
// Pure decision layer: NO discord.js imports. This module computes WHETHER a
// suggestion should be offered and the data a caller needs to render it. The
// impure orchestration (weekly worker job, DM/mod-log delivery, "Switch"/
// "Don't ask again" handling, config writes + config:changed publish) is wired
// by the worker and is intentionally kept out of this file so it stays unit-
// testable without a database, Redis, or Discord.

import {
  sizeTierFromMemberCount,
  evaluateSizeSuggestion,
  SIZE_SUGGESTION_MIN_DAYS,
  type SizeTier,
  type SizeSuggestion,
} from "./settings.js";

export { sizeTierFromMemberCount, evaluateSizeSuggestion, SIZE_SUGGESTION_MIN_DAYS };
export type { SizeTier, SizeSuggestion };

/** Direction of a tier change, used to phrase the suggestion template (§8.8). */
export type SizeChangeDirection = "up" | "down" | "none";

/** Everything a caller needs to render an adaptive size suggestion (§8.8). */
export interface AdaptiveSizeDecision {
  /** The tier implied by the guild's current member count. */
  currentTier: SizeTier;
  /** The tier currently stored in GuildConfig. */
  storedTier: SizeTier;
  /** Whether the owner should be prompted (all §8.8 gates passed). */
  shouldSuggest: boolean;
  /** Direction the tier would move if the owner accepts. */
  direction: SizeChangeDirection;
}

/** Raw inputs the weekly job reads before computing a suggestion. */
export interface AdaptiveSizeInput {
  /** The guild's current memberCount (from Discord). */
  memberCount: number;
  /** The guild's stored GuildConfig.sizeTier. */
  storedTier: SizeTier;
  /** The guild's stored GuildConfig.sizeTierLocked. */
  sizeTierLocked: boolean;
  /** Consecutive days the member count has stayed in the new tier (DailyGuildStat). */
  daysInNewTier: number;
}

const TIER_ORDER: readonly SizeTier[] = ["TINY", "SMALL", "MEDIUM", "LARGE", "MASSIVE"];

function tierIndex(t: SizeTier): number {
  return TIER_ORDER.indexOf(t);
}

function changeDirection(currentTier: SizeTier, storedTier: SizeTier): SizeChangeDirection {
  const cur = tierIndex(currentTier);
  const stored = tierIndex(storedTier);
  if (cur > stored) return "up";
  if (cur < stored) return "down";
  return "none";
}

/**
 * Compute a pure adaptive size decision from the weekly job's inputs (§8.8).
 *
 * This is a thin, side-effect-free wrapper over {@link evaluateSizeSuggestion}
 * that additionally derives the {@link SizeChangeDirection}. It performs NO
 * config mutation: "Switch" and "Don't ask again" are applied by the caller.
 */
export function computeAdaptiveSizeDecision(input: AdaptiveSizeInput): AdaptiveSizeDecision {
  const suggestion: SizeSuggestion = evaluateSizeSuggestion(
    input.memberCount,
    input.storedTier,
    input.sizeTierLocked,
    input.daysInNewTier,
  );

  return {
    currentTier: suggestion.currentTier,
    storedTier: suggestion.storedTier,
    shouldSuggest: suggestion.shouldSuggest,
    direction: suggestion.shouldSuggest
      ? changeDirection(suggestion.currentTier, suggestion.storedTier)
      : "none",
  };
}