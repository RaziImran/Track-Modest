import { describe, it, expect } from "vitest";
import { sizeTierFromMemberCount, evaluateSizeSuggestion } from "./settings.js";
import { computeAdaptiveSizeDecision } from "./adaptive-size.js";

describe("sizeTierFromMemberCount (§8.2 boundaries)", () => {
  it("classifies counts below 50 as TINY", () => {
    expect(sizeTierFromMemberCount(0)).toBe("TINY");
    expect(sizeTierFromMemberCount(49)).toBe("TINY");
  });

  it("classifies 50–499 as SMALL (boundary at 50)", () => {
    expect(sizeTierFromMemberCount(50)).toBe("SMALL");
    expect(sizeTierFromMemberCount(499)).toBe("SMALL");
  });

  it("classifies 500–4,999 as MEDIUM (boundary at 500)", () => {
    expect(sizeTierFromMemberCount(500)).toBe("MEDIUM");
    expect(sizeTierFromMemberCount(4_999)).toBe("MEDIUM");
  });

  it("classifies 5,000–49,999 as LARGE (boundary at 5,000)", () => {
    expect(sizeTierFromMemberCount(5_000)).toBe("LARGE");
    expect(sizeTierFromMemberCount(49_999)).toBe("LARGE");
  });

  it("classifies >= 50,000 as MASSIVE (boundary at 50,000)", () => {
    expect(sizeTierFromMemberCount(50_000)).toBe("MASSIVE");
    expect(sizeTierFromMemberCount(100_000)).toBe("MASSIVE");
  });

  it("matches the §8.8 example: 620 members → MEDIUM", () => {
    expect(sizeTierFromMemberCount(620)).toBe("MEDIUM");
  });
});

describe("evaluateSizeSuggestion (§8.8 gate)", () => {
  it("does not suggest when member tier equals the stored tier", () => {
    const r = evaluateSizeSuggestion(620, "MEDIUM", false, 30);
    expect(r.currentTier).toBe("MEDIUM");
    expect(r.storedTier).toBe("MEDIUM");
    expect(r.shouldSuggest).toBe(false);
  });

  it("does not suggest when tiers differ but the tier is locked", () => {
    const r = evaluateSizeSuggestion(620, "SMALL", true, 30);
    expect(r.currentTier).toBe("MEDIUM");
    expect(r.shouldSuggest).toBe(false);
  });

  it("does not suggest when tiers differ, unlocked, but fewer than 7 days", () => {
    const r = evaluateSizeSuggestion(620, "SMALL", false, 6);
    expect(r.shouldSuggest).toBe(false);
  });

  it("suggests when tiers differ, unlocked, and in the new tier for >= 7 days", () => {
    const r = evaluateSizeSuggestion(620, "SMALL", false, 7);
    expect(r.currentTier).toBe("MEDIUM");
    expect(r.storedTier).toBe("SMALL");
    expect(r.shouldSuggest).toBe(true);
  });

  it("suggests a downward move too (shrink from LARGE to MEDIUM)", () => {
    const r = evaluateSizeSuggestion(620, "LARGE", false, 10);
    expect(r.currentTier).toBe("MEDIUM");
    expect(r.shouldSuggest).toBe(true);
  });
});

describe("computeAdaptiveSizeDecision", () => {
  it("reports an upward direction when the guild grew", () => {
    const d = computeAdaptiveSizeDecision({
      memberCount: 620,
      storedTier: "SMALL",
      sizeTierLocked: false,
      daysInNewTier: 7,
    });
    expect(d.shouldSuggest).toBe(true);
    expect(d.currentTier).toBe("MEDIUM");
    expect(d.storedTier).toBe("SMALL");
    expect(d.direction).toBe("up");
  });

  it("reports a downward direction when the guild shrank", () => {
    const d = computeAdaptiveSizeDecision({
      memberCount: 620,
      storedTier: "LARGE",
      sizeTierLocked: false,
      daysInNewTier: 10,
    });
    expect(d.shouldSuggest).toBe(true);
    expect(d.direction).toBe("down");
  });

  it("reports direction 'none' and no suggestion when all gates fail", () => {
    const d = computeAdaptiveSizeDecision({
      memberCount: 620,
      storedTier: "SMALL",
      sizeTierLocked: true,
      daysInNewTier: 30,
    });
    expect(d.shouldSuggest).toBe(false);
    expect(d.direction).toBe("none");
  });

  it("never suggests for an unchanged tier even after many days", () => {
    const d = computeAdaptiveSizeDecision({
      memberCount: 120,
      storedTier: "SMALL",
      sizeTierLocked: false,
      daysInNewTier: 365,
    });
    expect(d.shouldSuggest).toBe(false);
    expect(d.direction).toBe("none");
  });
});