// §15.4 Shadow mode — pure service layer tests.
import { describe, it, expect, vi } from "vitest";
import { ShadowModeService } from "./service.js";
import type { ShadowModeServiceDeps } from "./service.js";

const now = new Date("2026-11-22T12:00:00Z");

const baseDeps = (): ShadowModeServiceDeps => ({
  getShadowRules: vi.fn(),
  recordShadowHit: vi.fn(),
  setShadowDuration: vi.fn(),
  disableShadow: vi.fn(),
});

describe("ShadowModeService", () => {
  describe("enableShadow", () => {
    it("calls setShadowDuration with guildId, ruleId and days", async () => {
      const deps = baseDeps();
      const service = new ShadowModeService(deps);

      await service.enableShadow("g1", 42, 7);

      expect(deps.setShadowDuration).toHaveBeenCalledTimes(1);
      expect(deps.setShadowDuration).toHaveBeenCalledWith("g1", 42, 7);
    });

    it("defaults to 7 days", async () => {
      const deps = baseDeps();
      const service = new ShadowModeService(deps);

      await service.enableShadow("g1", 42);

      expect(deps.setShadowDuration).toHaveBeenCalledWith("g1", 42, 7);
    });
  });

  describe("disableShadow", () => {
    it("calls disableShadow with guildId and ruleId", async () => {
      const deps = baseDeps();
      const service = new ShadowModeService(deps);

      await service.disableShadow("g1", 42);

      expect(deps.disableShadow).toHaveBeenCalledTimes(1);
      expect(deps.disableShadow).toHaveBeenCalledWith("g1", 42);
    });
  });

  describe("recordShadowHit", () => {
    it("passes the input through to recordShadowHit", async () => {
      const deps = baseDeps();
      const service = new ShadowModeService(deps);

      await service.recordShadowHit({
        guildId: "g1",
        ruleId: 42,
        ruleName: "spam",
        isFalsePositive: false,
      });

      expect(deps.recordShadowHit).toHaveBeenCalledTimes(1);
      expect(deps.recordShadowHit).toHaveBeenCalledWith({
        guildId: "g1",
        ruleId: 42,
        ruleName: "spam",
        isFalsePositive: false,
      });
    });
  });

  describe("computeSummary", () => {
    const rule = {
      ruleId: 42,
      guildId: "g1",
      ruleName: "spam",
      shadowStartedAt: new Date("2026-11-20T12:00:00Z"), // 2 days before now
      shadowUntil: new Date("2026-11-25T12:00:00Z"), // 3 days after now
      hitCount: 10,
      falsePositiveCount: 3,
    };

    it("computes daysActive, expired=false, wouldHaveActed", () => {
      const service = new ShadowModeService(baseDeps());
      const summary = service.computeSummary(rule, now);

      expect(summary).toEqual({
        ruleId: 42,
        ruleName: "spam",
        hitCount: 10,
        falsePositiveCount: 3,
        wouldHaveActed: 7,
        daysActive: 2,
        expired: false,
      });
    });

    it("marks expired when now is past shadowUntil", () => {
      const service = new ShadowModeService(baseDeps());
      const expiredRule = { ...rule, shadowUntil: new Date("2026-11-21T12:00:00Z") };
      const summary = service.computeSummary(expiredRule, now);

      expect(summary.expired).toBe(true);
    });

    it("clamps daysActive at 0 when started in the future", () => {
      const service = new ShadowModeService(baseDeps());
      const futureRule = { ...rule, shadowStartedAt: new Date("2026-11-23T12:00:00Z") };
      const summary = service.computeSummary(futureRule, now);

      expect(summary.daysActive).toBe(0);
    });
  });

  describe("isExpired", () => {
    it("returns false when shadowUntil is in the future", () => {
      const service = new ShadowModeService(baseDeps());
      const rule = {
        ruleId: 1,
        guildId: "g1",
        ruleName: "spam",
        shadowStartedAt: new Date("2026-11-20T12:00:00Z"),
        shadowUntil: new Date("2026-11-25T12:00:00Z"),
        hitCount: 0,
        falsePositiveCount: 0,
      };

      expect(service.isExpired(rule, now)).toBe(false);
    });

    it("returns true when shadowUntil is in the past", () => {
      const service = new ShadowModeService(baseDeps());
      const rule = {
        ruleId: 1,
        guildId: "g1",
        ruleName: "spam",
        shadowStartedAt: new Date("2026-11-20T12:00:00Z"),
        shadowUntil: new Date("2026-11-21T12:00:00Z"),
        hitCount: 0,
        falsePositiveCount: 0,
      };

      expect(service.isExpired(rule, now)).toBe(true);
    });
  });

  describe("delegation", () => {
    it("getShadowRules delegates to deps", async () => {
      const getShadowRules = vi.fn().mockResolvedValue([]);
      const deps = { ...baseDeps(), getShadowRules };
      const service = new ShadowModeService(deps);

      await service.getShadowRules("g1");

      expect(getShadowRules).toHaveBeenCalledWith("g1");
    });
  });
});
