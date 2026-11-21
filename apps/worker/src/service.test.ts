import { describe, it, expect, vi } from "vitest";
import { CaseExpiryService, type ExpiredCase, type ExpiryDeps } from "./service.js";

const NOW = new Date("2026-01-01T00:00:00Z");

const makeCase = (overrides: Partial<ExpiredCase>): ExpiredCase => ({
  id: 1,
  guildId: "g1",
  targetId: "u1",
  type: "TEMPBAN",
  expiresAt: new Date("2025-12-01T00:00:00Z"),
  undone: false,
  ...overrides,
});

type ExpiryParams = {
  type: "TEMPBAN" | "TIMEOUT";
  guildId: string;
  targetId: string;
  reason: string;
};

describe("CaseExpiryService.selectDueCases", () => {
  it("returns only undone cases whose expiresAt is before now", () => {
    const cases = [
      makeCase({ id: 1, undone: false, expiresAt: new Date("2025-01-01T00:00:00Z") }),
      makeCase({ id: 2, undone: true, expiresAt: new Date("2025-01-01T00:00:00Z") }),
      makeCase({ id: 3, undone: false, expiresAt: new Date("2099-01-01T00:00:00Z") }),
    ];
    const result = CaseExpiryService.selectDueCases(cases, NOW);
    expect(result.map((c) => c.id)).toEqual([1]);
  });

  it("returns an empty array when no case is due", () => {
    const cases = [
      makeCase({ id: 1, undone: true }),
      makeCase({ id: 2, expiresAt: new Date("2099-01-01T00:00:00Z") }),
    ];
    expect(CaseExpiryService.selectDueCases(cases, NOW)).toEqual([]);
  });
});

describe("CaseExpiryService.expireCase", () => {
  it("performs the expiry action and marks the case undone", async () => {
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue(makeCase({ id: 7 }));
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const logger = { error: vi.fn(), info: vi.fn() };
    const deps: ExpiryDeps = { findExpiredCases: vi.fn(), findCaseById, markCaseUndone, performExpiry, logger };
    const service = new CaseExpiryService(deps);

    await service.expireCase(makeCase({ id: 7 }));

    expect(performExpiry).toHaveBeenCalledTimes(1);
    expect(performExpiry).toHaveBeenCalledWith({
      type: "TEMPBAN",
      guildId: "g1",
      targetId: "u1",
      reason: "Temporary moderation action expired",
    });
    expect(markCaseUndone).toHaveBeenCalledTimes(1);
    expect(markCaseUndone).toHaveBeenCalledWith(7);
  });

  it("skips a case that is already undone", async () => {
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue(makeCase({ id: 7, undone: true }));
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const deps: ExpiryDeps = { findExpiredCases: vi.fn(), findCaseById, markCaseUndone, performExpiry, logger: { error: vi.fn(), info: vi.fn() } };
    const service = new CaseExpiryService(deps);

    await service.expireCase(makeCase({ id: 7 }));

    expect(performExpiry).not.toHaveBeenCalled();
    expect(markCaseUndone).not.toHaveBeenCalled();
  });

  it("skips a case that is not yet due", async () => {
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue(makeCase({ id: 7, expiresAt: new Date("2099-01-01T00:00:00Z") }));
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const deps: ExpiryDeps = { findExpiredCases: vi.fn(), findCaseById, markCaseUndone, performExpiry, logger: { error: vi.fn(), info: vi.fn() } };
    const service = new CaseExpiryService(deps);

    await service.expireCase(makeCase({ id: 7 }));

    expect(performExpiry).not.toHaveBeenCalled();
    expect(markCaseUndone).not.toHaveBeenCalled();
  });

  it("treats a missing case as already handled", async () => {
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue(null);
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const deps: ExpiryDeps = { findExpiredCases: vi.fn(), findCaseById, markCaseUndone, performExpiry, logger: { error: vi.fn(), info: vi.fn() } };
    const service = new CaseExpiryService(deps);

    await service.expireCase(makeCase({ id: 7 }));

    expect(performExpiry).not.toHaveBeenCalled();
    expect(markCaseUndone).not.toHaveBeenCalled();
  });

  it("logs a Discord error and still marks the case undone", async () => {
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue(makeCase({ id: 7 }));
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockRejectedValue(new Error("discord boom"));
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const logger = { error: vi.fn(), info: vi.fn() };
    const deps: ExpiryDeps = { findExpiredCases: vi.fn(), findCaseById, markCaseUndone, performExpiry, logger };
    const service = new CaseExpiryService(deps);

    await expect(service.expireCase(makeCase({ id: 7 }))).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(markCaseUndone).toHaveBeenCalledTimes(1);
  });
});

describe("CaseExpiryService.runRecoverySweep", () => {
  it("processes all due cases and returns counts", async () => {
    const findExpiredCases = vi.fn<() => Promise<ExpiredCase[]>>().mockResolvedValue([
      makeCase({ id: 1 }),
      makeCase({ id: 2, undone: true }),
      makeCase({ id: 3, expiresAt: new Date("2099-01-01T00:00:00Z") }),
    ]);
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockImplementation((id) => Promise.resolve(makeCase({ id })));
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const logger = { error: vi.fn(), info: vi.fn() };
    const deps: ExpiryDeps = { findExpiredCases, findCaseById, markCaseUndone, performExpiry, logger };
    const service = new CaseExpiryService(deps);

    const result = await service.runRecoverySweep();

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(markCaseUndone).toHaveBeenCalledTimes(1);
  });

  it("counts a failed expiry without crashing", async () => {
    const findExpiredCases = vi.fn<() => Promise<ExpiredCase[]>>().mockResolvedValue([makeCase({ id: 1 })]);
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue(makeCase({ id: 1 }));
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockRejectedValue(new Error("db down"));
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const logger = { error: vi.fn(), info: vi.fn() };
    const deps: ExpiryDeps = { findExpiredCases, findCaseById, markCaseUndone, performExpiry, logger };
    const service = new CaseExpiryService(deps);

    const result = await service.runRecoverySweep();

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
  });
});
