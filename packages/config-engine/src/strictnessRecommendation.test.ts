import { describe, it, expect } from "vitest";
import { recommendStrictness } from "./strictnessRecommendation.js";
import { type Strictness } from "./settings.js";

describe("recommendStrictness (§8.9)", () => {
  const baseInput = {
    automodHits: 0,
    manualWarns: 0,
    manualTimeouts: 0,
    raidsDetected: 0,
    automodFalsePositives: 0,
    currentStrictness: "BALANCED" as Strictness,
  };

  describe("Rule 1: Mods doing most of the work → stricter", () => {
    it("recommends STRICT when manual actions ≥ 20 and automod hits < manual actions", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 15,
        manualTimeouts: 5,
        automodHits: 10,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("stricter");
      expect(r.reasonKey).toBe("cfg.strictness.reason.modsDoingWork");
    });

    it("recommends BALANCED when current is RELAXED and conditions met", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 20,
        manualTimeouts: 0,
        automodHits: 10,
        currentStrictness: "RELAXED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("stricter");
    });

    it("recommends STRICT (capped) when current is STRICT", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 20,
        manualTimeouts: 0,
        automodHits: 10,
        currentStrictness: "STRICT",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.shouldSuggest).toBe(false);
      expect(r.direction).toBe("none");
    });

    it("recommends LOCKDOWN when current is LOCKDOWN (no change)", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 20,
        manualTimeouts: 0,
        automodHits: 10,
        currentStrictness: "LOCKDOWN",
      });
      expect(r.recommended).toBe("LOCKDOWN");
      expect(r.shouldSuggest).toBe(false);
      expect(r.direction).toBe("none");
    });

    it("does not trigger when manual actions < 20", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 10,
        manualTimeouts: 5,
        automodHits: 5,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
    });

    it("does not trigger when automod hits ≥ manual actions", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 15,
        manualTimeouts: 5,
        automodHits: 25,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
    });

    it("does not trigger when manual actions = 20 but automod hits = manual actions", () => {
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 20,
        manualTimeouts: 0,
        automodHits: 20,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
    });
  });

  describe("Rule 2: AutoMod false positives → more relaxed", () => {
    it("recommends RELAXED when automod hits ≥ 50 and false positive ratio ≥ 30%", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 100,
        automodFalsePositives: 35,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("RELAXED");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("more_relaxed");
      expect(r.reasonKey).toBe("cfg.strictness.reason.automodFalsePositives");
    });

    it("recommends BALANCED when current is STRICT and conditions met", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 60,
        automodFalsePositives: 20, // 33%
        currentStrictness: "STRICT",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("more_relaxed");
    });

    it("recommends RELAXED (floored) when current is RELAXED", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 100,
        automodFalsePositives: 50,
        currentStrictness: "RELAXED",
      });
      expect(r.recommended).toBe("RELAXED");
      expect(r.shouldSuggest).toBe(false);
      expect(r.direction).toBe("none");
    });

    it("does not trigger when automod hits < 50", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 49,
        automodFalsePositives: 20,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
    });

    it("does not trigger when false positive ratio < 30%", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 100,
        automodFalsePositives: 25, // 25%
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
    });

    it("does not trigger when false positive ratio = 30% exactly", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 100,
        automodFalsePositives: 30, // exactly 30%
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("RELAXED");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("more_relaxed");
    });
  });

  describe("Rule 3: Raids detected → consider STRICT", () => {
    it("recommends STRICT when 2+ raids detected and current is BALANCED", () => {
      const r = recommendStrictness({
        ...baseInput,
        raidsDetected: 2,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("stricter");
      expect(r.reasonKey).toBe("cfg.strictness.reason.raidsDetected");
    });

    it("recommends STRICT when 3 raids detected and current is RELAXED", () => {
      const r = recommendStrictness({
        ...baseInput,
        raidsDetected: 3,
        currentStrictness: "RELAXED",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.shouldSuggest).toBe(true);
      expect(r.direction).toBe("stricter");
    });

    it("recommends LOCKDOWN when current is LOCKDOWN (no change)", () => {
      const r = recommendStrictness({
        ...baseInput,
        raidsDetected: 2,
        currentStrictness: "LOCKDOWN",
      });
      expect(r.recommended).toBe("LOCKDOWN");
      expect(r.shouldSuggest).toBe(false);
      expect(r.direction).toBe("none");
    });

    it("recommends STRICT when current is STRICT (no change)", () => {
      const r = recommendStrictness({
        ...baseInput,
        raidsDetected: 2,
        currentStrictness: "STRICT",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.shouldSuggest).toBe(false);
      expect(r.direction).toBe("none");
    });

    it("does not trigger when raids detected < 2", () => {
      const r = recommendStrictness({
        ...baseInput,
        raidsDetected: 1,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
    });
  });

  describe("Rule priority and interactions", () => {
    it("Rule 1 takes priority over Rule 2", () => {
      // Both Rule 1 and Rule 2 conditions met, but Rule 1 should win
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 25,
        manualTimeouts: 0,
        automodHits: 10,
        automodFalsePositives: 5,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.reasonKey).toBe("cfg.strictness.reason.modsDoingWork");
    });

    it("Rule 1 takes priority over Rule 3", () => {
      // Both Rule 1 and Rule 3 conditions met, but Rule 1 should win
      const r = recommendStrictness({
        ...baseInput,
        manualWarns: 25,
        manualTimeouts: 0,
        automodHits: 10,
        raidsDetected: 3,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("STRICT");
      expect(r.reasonKey).toBe("cfg.strictness.reason.modsDoingWork");
    });

    it("Rule 2 takes priority over Rule 3", () => {
      // Both Rule 2 and Rule 3 conditions met, but Rule 2 should win
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 100,
        automodFalsePositives: 40,
        raidsDetected: 3,
        currentStrictness: "STRICT",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.reasonKey).toBe("cfg.strictness.reason.automodFalsePositives");
    });
  });

  describe("No change recommended", () => {
    it("returns current strictness when no rules match", () => {
      const r = recommendStrictness({
        ...baseInput,
        automodHits: 10,
        manualWarns: 5,
        manualTimeouts: 2,
        raidsDetected: 0,
        automodFalsePositives: 1,
        currentStrictness: "BALANCED",
      });
      expect(r.recommended).toBe("BALANCED");
      expect(r.shouldSuggest).toBe(false);
      expect(r.direction).toBe("none");
      expect(r.reasonKey).toBe("cfg.strictness.reason.noChange");
    });

    it("returns current strictness for all levels when no rules match", () => {
      for (const strictness of ["RELAXED", "BALANCED", "STRICT", "LOCKDOWN"] as Strictness[]) {
        const r = recommendStrictness({
          ...baseInput,
          currentStrictness: strictness,
        });
        expect(r.recommended).toBe(strictness);
        expect(r.shouldSuggest).toBe(false);
      }
    });
  });
});