import { describe, it, expect } from "vitest";
import {
  resolveSetting,
  resolveAll,
  computeEffectiveStrictness,
  computeTrustShift,
  indexToStrictness,
  applySizeScaling,
  BASE_TABLE,
} from "./settings.js";

const SIZE_TIERS = ["TINY", "SMALL", "MEDIUM", "LARGE", "MASSIVE"] as const;
const STRICTNESS_LEVELS = ["RELAXED", "BALANCED", "STRICT", "LOCKDOWN"] as const;
const TRUST_SHIFTS = [-1, 0, 1] as const;

function makeCfg(
  size: string = "SMALL",
  strictness: string = "BALANCED",
  overrides: Record<string, unknown> = {},
  channelOverrides: Record<string, { strictness?: string; settings?: Record<string, unknown> }> = {},
  tempBoost: { strictness: string; startedBy: string; endsAt: string } | null = null,
) {
  return {
    guildId: "123456789",
    sizeTier: size as any,
    sizeTierLocked: false,
    strictness: strictness as any,
    modules: {},
    overrides,
    channelOverrides: channelOverrides as any,
    staffRoles: {},
    logChannels: {},
    temporaryBoost: tempBoost as any,
  } as any;
}

function makeCtx(
  channelId?: string,
  memberRep?: number,
) {
  return { guildId: "123456789", channelId, memberRep };
}

describe("computeTrustShift", () => {
  it("returns -1 for very low rep", () => {
    expect(computeTrustShift(-101)).toBe(-1);
    expect(computeTrustShift(-1000)).toBe(-1);
  });
  it("returns 0 for normal rep", () => {
    expect(computeTrustShift(0)).toBe(0);
    expect(computeTrustShift(50)).toBe(0);
    expect(computeTrustShift(100)).toBe(0);
    expect(computeTrustShift(undefined)).toBe(0);
  });
  it("returns 1 for high rep", () => {
    expect(computeTrustShift(101)).toBe(1);
    expect(computeTrustShift(9999)).toBe(1);
  });
});

describe("indexToStrictness", () => {
  it("maps 0->RELAXED, 1->BALANCED, 2->STRICT, 3->LOCKDOWN", () => {
    expect(indexToStrictness(0)).toBe("RELAXED");
    expect(indexToStrictness(1)).toBe("BALANCED");
    expect(indexToStrictness(2)).toBe("STRICT");
    expect(indexToStrictness(3)).toBe("LOCKDOWN");
  });
});

describe("computeEffectiveStrictness", () => {
  it("base strictness with no boost/channel/shift", () => {
    const cfg = makeCfg("MEDIUM", "STRICT");
    const ctx = makeCtx(undefined, 0);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("STRICT");
  });
  it("temporary boost wins if stricter", () => {
    const cfg = makeCfg("MEDIUM", "BALANCED", {}, {}, { strictness: "LOCKDOWN", startedBy: "system", endsAt: "now" });
    const ctx = makeCtx(undefined, 0);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("LOCKDOWN");
  });
  it("temporary boost does not weaken", () => {
    const cfg = makeCfg("MEDIUM", "STRICT", {}, {}, { strictness: "RELAXED", startedBy: "system", endsAt: "now" });
    const ctx = makeCtx(undefined, 0);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("STRICT");
  });
  it("channel override strictness applies", () => {
    const cfg = makeCfg("MEDIUM", "BALANCED", {}, { "chan1": { strictness: "STRICT" } });
    const ctx = makeCtx("chan1", 0);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("STRICT");
  });
  it("trust shift +1 raises strictness", () => {
    const cfg = makeCfg("MEDIUM", "BALANCED");
    const ctx = makeCtx(undefined, 200);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("STRICT");
  });
  it("trust shift -1 lowers strictness", () => {
    const cfg = makeCfg("MEDIUM", "STRICT");
    const ctx = makeCtx(undefined, -200);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("BALANCED");
  });
  it("trust shift never below RELAXED", () => {
    const cfg = makeCfg("MEDIUM", "RELAXED");
    const ctx = makeCtx(undefined, -200);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("RELAXED");
  });
  it("trust shift max STRICT unless guild is LOCKDOWN", () => {
    const cfg = makeCfg("MEDIUM", "STRICT");
    const ctx = makeCtx(undefined, 200);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("STRICT");
  });
  it("trust shift can reach LOCKDOWN if guild is LOCKDOWN", () => {
    const cfg = makeCfg("MEDIUM", "LOCKDOWN");
    const ctx = makeCtx(undefined, 200);
    expect(computeEffectiveStrictness(cfg, ctx)).toBe("LOCKDOWN");
  });
});

describe("base table", () => {
  it("has all settings per strictness", () => {
    const keys = Object.keys(BASE_TABLE);
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      for (const s of STRICTNESS_LEVELS) {
        expect(BASE_TABLE[key]![s]).toBeDefined();
      }
    }
  });
  it("automod.spam.maxMessages decreases with strictness", () => {
    const row = (BASE_TABLE["automod.spam.maxMessages"] as Record<string, number>)!;
    expect(row["RELAXED"]!).toBeGreaterThan(row["BALANCED"]!);
    expect(row["BALANCED"]!).toBeGreaterThan(row["STRICT"]!);
    expect(row["STRICT"]!).toBeGreaterThan(row["LOCKDOWN"]!);
  });
  it("verify.mode gets stricter across levels", () => {
    const row = (BASE_TABLE["verify.mode"] as Record<string, string>)!;
    const order = ["off", "new_accounts", "everyone", "everyone_captcha"] as const;
    const v = (k: string) => row[k] as "off" | "new_accounts" | "everyone" | "everyone_captcha";
    expect(order.indexOf(v("RELAXED"))).toBeLessThan(order.indexOf(v("BALANCED")));
    expect(order.indexOf(v("BALANCED"))).toBeLessThan(order.indexOf(v("STRICT")));
  });
});

describe("size scaling", () => {
  it("TINY raises spam maxMessages by 2", () => {
    const adj = applySizeScaling("automod.spam.maxMessages", 7, "TINY");
    expect(adj.value).toBe(9);
  });
  it("SMALL raises spam maxMessages by 1", () => {
    const adj = applySizeScaling("automod.spam.maxMessages", 7, "SMALL");
    expect(adj.value).toBe(8);
  });
  it("MEDIUM keeps spam maxMessages", () => {
    const adj = applySizeScaling("automod.spam.maxMessages", 7, "MEDIUM");
    expect(adj.value).toBe(7);
  });
  it("MASSIVE lowers spam maxMessages by 1", () => {
    const adj = applySizeScaling("automod.spam.maxMessages", 5, "MASSIVE");
    expect(adj.value).toBe(4);
  });
  it("TINY softens firstAction", () => {
    const adj = applySizeScaling("automod.firstAction", "delete_timeout", "TINY");
    expect(adj.value).toBe("delete_warn");
  });
  it("MASSIVE hardens firstAction", () => {
    const adj = applySizeScaling("automod.firstAction", "alert", "MASSIVE");
    expect(adj.value).toBe("delete_warn");
  });
  it("TINY reduces raid.minJoins", () => {
    const adj = applySizeScaling("raid.minJoins", 10, "TINY");
    expect(adj.value).toBe(6);
  });
  it("MASSIVE increases raid.minJoins ×6", () => {
    const adj = applySizeScaling("raid.minJoins", 10, "MASSIVE");
    expect(adj.value).toBe(60);
  });
  it("TINY softens verify.mode", () => {
    const adj = applySizeScaling("verify.mode", "everyone", "TINY");
    expect(adj.value).toBe("new_accounts");
  });
  it("LARGE sets logging.verbosity to important", () => {
    const adj = applySizeScaling("logging.verbosity", "all", "LARGE");
    expect(adj.value).toBe("important");
  });
});

describe("resolveSetting resolution order (§8.3)", () => {
  it("guild override beats size scaling", () => {
    const cfg = makeCfg("SMALL", "BALANCED", { "automod.spam.maxMessages": 20 });
    const ctx = makeCtx(undefined, 0);
    expect(resolveSetting(cfg, "automod.spam.maxMessages", ctx)).toBe(20);
  });
  it("channel override beats guild override", () => {
    const cfg = makeCfg("SMALL", "BALANCED", { "automod.spam.maxMessages": 20 }, {
      "chan1": { settings: { "automod.spam.maxMessages": 3 } },
    });
    const ctx = makeCtx("chan1", 0);
    expect(resolveSetting(cfg, "automod.spam.maxMessages", ctx)).toBe(3);
  });
  it("guild override is absolute — not size-scaled", () => {
    const cfg = makeCfg("SMALL", "BALANCED", { "automod.spam.maxMessages": 20 });
    const ctx = makeCtx(undefined, 0);
    expect(resolveSetting(cfg, "automod.spam.maxMessages", ctx)).toBe(20);
  });
});

describe("resolveAll snapshot (§8.6)", () => {
  it("produces a value for every setting across all size × strictness × trust combos", () => {
    let count = 0;
    for (const size of SIZE_TIERS) {
      for (const strictness of STRICTNESS_LEVELS) {
        for (const shift of TRUST_SHIFTS) {
          const cfg = makeCfg(size, strictness);
          const rep = shift === -1 ? -200 : shift === 1 ? 200 : 0;
          const ctx = makeCtx(undefined, rep);
          const result = resolveAll(cfg, ctx);
          const keys = Object.keys(BASE_TABLE);
          for (const key of keys) {
            expect(result[key]).toBeDefined();
            count++;
          }
        }
      }
    }
    // 5 × 4 × 3 × 27 settings = 1620
    expect(count).toBe(1620);
  });
});
