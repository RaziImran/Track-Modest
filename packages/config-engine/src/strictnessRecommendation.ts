// Strictness recommendation (§8.9).
// Pure decision layer: NO discord.js imports. Computes a strictness level
// suggestion from monthly guild statistics. The impure orchestration (monthly
// job, DM/mod-log delivery, one-click apply handling, config writes) is kept
// out of this file so it stays unit-testable.

import { type Strictness } from "./settings.js";

/** Raw inputs the monthly job reads before computing a recommendation. */
export interface StrictnessRecommendationInput {
  /** Total AutoMod hits in the last 30 days. */
  automodHits: number;
  /** Manual warns issued in the last 30 days. */
  manualWarns: number;
  /** Manual timeouts issued in the last 30 days. */
  manualTimeouts: number;
  /** Raids detected/blocked in the last 30 days. */
  raidsDetected: number;
  /** AutoMod hits that were marked as false positives / undone by mods. */
  automodFalsePositives: number;
  /** Current strictness level of the guild. */
  currentStrictness: Strictness;
}

/** Outcome of {@link recommendStrictness}. */
export interface StrictnessRecommendation {
  /** The recommended strictness level. */
  recommended: Strictness;
  /** Human-readable reason for the recommendation (i18n key). */
  reasonKey: string;
  /** True if the recommendation differs from the current level. */
  shouldSuggest: boolean;
  /** Direction of change if applied. */
  direction: "stricter" | "more_relaxed" | "none";
}

/** Strictness levels in order. */
const STRICTNESS_ORDER: readonly Strictness[] = ["RELAXED", "BALANCED", "STRICT", "LOCKDOWN"];

/** Minimum manual actions (warns + timeouts) for the "mods doing work" rule. */
const MIN_MANUAL_ACTIONS_FOR_STRICTER = 20;
/** Minimum AutoMod hits for the "too many false positives" rule. */
const MIN_AUTOMOD_HITS_FOR_RELAXED = 50;
/** Minimum false positive ratio (30%) for the "too many false positives" rule. */
const FALSE_POSITIVE_RATIO_THRESHOLD = 0.3;
/** Minimum raids detected for the "consider Strict" rule. */
const MIN_RAIDS_FOR_STRICT = 2;

/**
 * Compute a strictness recommendation from monthly guild statistics (§8.9).
 *
 * Rules (evaluated in order, first match wins):
 * 1. If manual warns+timeouts ≥ 20 AND automod hits < manual actions →
 *    recommend one level stricter (max STRICT unless current is LOCKDOWN).
 * 2. If automod hits ≥ 50 AND ≥ 30% were false positives →
 *    recommend one level more relaxed (min RELAXED).
 * 3. If 2+ raids detected → recommend STRICT (or current if already stricter).
 * 4. Otherwise → no change recommended.
 *
 * This function never mutates config — the owner must explicitly act on a suggestion.
 */
export function recommendStrictness(input: StrictnessRecommendationInput): StrictnessRecommendation {
  const { automodHits, manualWarns, manualTimeouts, raidsDetected, automodFalsePositives, currentStrictness } = input;

  const manualActions = manualWarns + manualTimeouts;
  const currentIndex = STRICTNESS_ORDER.indexOf(currentStrictness);

  // Rule 1: Mods are doing most of the work → consider one level stricter
  if (manualActions >= MIN_MANUAL_ACTIONS_FOR_STRICTER && automodHits < manualActions) {
    const targetIndex = Math.min(currentIndex + 1, 2); // cap at STRICT (index 2) unless LOCKDOWN
    const recommended = currentIndex === 3 ? "LOCKDOWN" : STRICTNESS_ORDER[targetIndex]!;
    return {
      recommended,
      reasonKey: "cfg.strictness.reason.modsDoingWork",
      shouldSuggest: recommended !== currentStrictness,
      direction: recommended !== currentStrictness ? "stricter" : "none",
    };
  }

  // Rule 2: AutoMod catching too much (high false positives) → consider more relaxed
  if (automodHits >= MIN_AUTOMOD_HITS_FOR_RELAXED) {
    const falsePositiveRatio = automodFalsePositives / automodHits;
    if (falsePositiveRatio >= FALSE_POSITIVE_RATIO_THRESHOLD) {
      const targetIndex = Math.max(currentIndex - 1, 0); // floor at RELAXED
      const recommended = STRICTNESS_ORDER[targetIndex]!;
      return {
        recommended,
        reasonKey: "cfg.strictness.reason.automodFalsePositives",
        shouldSuggest: recommended !== currentStrictness,
        direction: recommended !== currentStrictness ? "more_relaxed" : "none",
      };
    }
  }

  // Rule 3: 2+ raids detected → consider Strict (and verification)
  if (raidsDetected >= MIN_RAIDS_FOR_STRICT) {
    const strictIndex = STRICTNESS_ORDER.indexOf("STRICT");
    const targetIndex = Math.max(currentIndex, strictIndex); // at least STRICT
    const recommended = STRICTNESS_ORDER[targetIndex]!;
    return {
      recommended,
      reasonKey: "cfg.strictness.reason.raidsDetected",
      shouldSuggest: recommended !== currentStrictness,
      direction: recommended !== currentStrictness ? "stricter" : "none",
    };
  }

  // Rule 4: No change recommended
  return {
    recommended: currentStrictness,
    reasonKey: "cfg.strictness.reason.noChange",
    shouldSuggest: false,
    direction: "none",
  };
}

/** i18n keys used by this module (for reference / documentation). */
export const STRICTNESS_I18N_KEYS = {
  reason: {
    modsDoingWork: "cfg.strictness.reason.modsDoingWork",
    automodFalsePositives: "cfg.strictness.reason.automodFalsePositives",
    raidsDetected: "cfg.strictness.reason.raidsDetected",
    noChange: "cfg.strictness.reason.noChange",
  },
  label: {
    relaxed: "cfg.strictness.label.relaxed",
    balanced: "cfg.strictness.label.balanced",
    strict: "cfg.strictness.label.strict",
    lockdown: "cfg.strictness.label.lockdown",
  },
  description: {
    relaxed: "cfg.strictness.description.relaxed",
    balanced: "cfg.strictness.description.balanced",
    strict: "cfg.strictness.description.strict",
    lockdown: "cfg.strictness.description.lockdown",
  },
} as const;