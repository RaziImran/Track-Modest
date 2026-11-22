import { describe, it, expect, vi } from "vitest";
import { TemporaryBoostService } from "./service.js";
import type { TemporaryBoostServiceDeps } from "./service.js";

const now = new Date("2026-01-01T00:00:00Z");

const makeBoostRow = (overrides: Record<string, any> = {}): TemporaryBoostServiceDeps["createTemporaryBoost"] extends (...args: any[]) => Promise<infer R> ? R : never => ({
  id: 1,
  guildId: "g1",
  strictness: "STRICT",
  reason: "test",
  startedBy: "u1",
  endsAt: new Date("2026-01-02T00:00:00Z"),
  createdAt: now,
  ...overrides,
});

const makeDeps = (overrides: Partial<TemporaryBoostServiceDeps> = {}): TemporaryBoostServiceDeps => ({
  createTemporaryBoost: vi.fn().mockResolvedValue(makeBoostRow()),
  getActiveTemporaryBoost: vi.fn().mockResolvedValue(null),
  endTemporaryBoost: vi.fn().mockResolvedValue(true),
  scheduleBoostEndJob: vi.fn().mockResolvedValue("boost:end:g1"),
  cancelBoostEndJob: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("TemporaryBoostService (§8.10)", () => {
  describe("applyBoost", () => {
    it("creates a boost row and schedules a job, returning endsAt", async () => {
      const deps = makeDeps();
      const svc = new TemporaryBoostService(deps);

      const start = Date.now();
      const result = await svc.applyBoost({
        guildId: "g1",
        strictness: "LOCKDOWN",
        reason: "raid",
        startedBy: "admin1",
        durationSec: 3600, // 1 hour
      });

      expect(deps.createTemporaryBoost).toHaveBeenCalledWith({
        guildId: "g1",
        strictness: "LOCKDOWN",
        reason: "raid",
        startedBy: "admin1",
        endsAt: expect.any(Date),
      });
      expect(deps.scheduleBoostEndJob).toHaveBeenCalledWith(
        "g1",
        "LOCKDOWN",
        expect.any(Date),
      );
      expect(result.durationSec).toBe(3600);
      expect(result.endsAt.getTime() - start).toBeGreaterThanOrEqual(3599000);
      expect(result.endsAt.getTime() - start).toBeLessThanOrEqual(3601000);
    });

    it("passes through deps errors", async () => {
      const deps = makeDeps({
        createTemporaryBoost: vi.fn().mockRejectedValue(new Error("db down")),
      });
      const svc = new TemporaryBoostService(deps);
      await expect(
        svc.applyBoost({
          guildId: "g1",
          strictness: "STRICT",
          reason: "r",
          startedBy: "u1",
          durationSec: 900,
        }),
      ).rejects.toThrow("db down");
    });
  });

  describe("endBoost", () => {
    it("ends active boost and cancels the job", async () => {
      const active = makeBoostRow({ strictness: "STRICT", endsAt: new Date("2026-02-01T00:00:00Z") });
      const deps = makeDeps({
        getActiveTemporaryBoost: vi.fn().mockResolvedValue(active),
        endTemporaryBoost: vi.fn().mockResolvedValue(true),
      });
      const svc = new TemporaryBoostService(deps);

      const ended = await svc.endBoost("g1");
      expect(ended).toBe(true);
      expect(deps.endTemporaryBoost).toHaveBeenCalledWith("g1");
      expect(deps.cancelBoostEndJob).toHaveBeenCalledWith("g1");
    });

    it("returns false when no active boost", async () => {
      const deps = makeDeps({ getActiveTemporaryBoost: vi.fn().mockResolvedValue(null) });
      const svc = new TemporaryBoostService(deps);

      const ended = await svc.endBoost("g1");
      expect(ended).toBe(false);
      expect(deps.endTemporaryBoost).not.toHaveBeenCalled();
      expect(deps.cancelBoostEndJob).not.toHaveBeenCalled();
    });

    it("cancels job even if delete fails", async () => {
      const active = makeBoostRow({ endsAt: new Date("2026-02-01T00:00:00Z") });
      const deps = makeDeps({
        getActiveTemporaryBoost: vi.fn().mockResolvedValue(active),
        endTemporaryBoost: vi.fn().mockResolvedValue(false),
      });
      const svc = new TemporaryBoostService(deps);

      const ended = await svc.endBoost("g1");
      expect(ended).toBe(false);
      expect(deps.cancelBoostEndJob).toHaveBeenCalledWith("g1");
    });
  });

  describe("parseDuration (static)", () => {
    it("parses simple durations", () => {
      expect(TemporaryBoostService.parseDuration("15m")).toBe(900);
      expect(TemporaryBoostService.parseDuration("1h")).toBe(3600);
      expect(TemporaryBoostService.parseDuration("1d")).toBe(86400);
    });

    it("parses combined durations", () => {
      expect(TemporaryBoostService.parseDuration("2h30m")).toBe(9000);
      expect(TemporaryBoostService.parseDuration("1h15m")).toBe(4500);
      expect(TemporaryBoostService.parseDuration("90m")).toBe(5400);
    });

    it("throws on invalid input", () => {
      expect(() => TemporaryBoostService.parseDuration("")).toThrow("Invalid duration");
      expect(() => TemporaryBoostService.parseDuration("abc")).toThrow("Invalid duration");
      expect(() => TemporaryBoostService.parseDuration("1x")).toThrow("Invalid duration");
      expect(() => TemporaryBoostService.parseDuration("1h2x3m")).toThrow("Invalid duration");
    });
  });

  describe("validateDurationSec (static)", () => {
    it("accepts 15 minutes", () => {
      const r = TemporaryBoostService.validateDurationSec(15 * 60);
      if (r.ok === false) throw new Error("should be ok");
      expect(r.durationSec).toBe(900);
    });

    it("accepts 24 hours", () => {
      const r = TemporaryBoostService.validateDurationSec(24 * 60 * 60);
      if (r.ok === false) throw new Error("should be ok");
      expect(r.durationSec).toBe(86400);
    });

    it("rejects below 15 minutes", () => {
      const r = TemporaryBoostService.validateDurationSec(14 * 60);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("15 minutes");
    });

    it("rejects above 24 hours", () => {
      const r = TemporaryBoostService.validateDurationSec(25 * 60 * 60);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("24 hours");
    });
  });
});
