import { describe, it, expect, vi } from "vitest";
import { ModerationService } from "./service.js";

const baseDeps = () => ({
  incrementCaseCounter: vi.fn(),
  createCase: vi.fn(),
  applyRepPenalty: vi.fn(),
  getActiveWarnPoints: vi.fn(),
  getLadderCasesInWindow: vi.fn(),
});

describe("ModerationService.applyWarn", () => {
  it("increments the case counter, creates a WARN case, applies the -20 × points rep penalty and returns the ids", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(7);
    deps.createCase.mockResolvedValue({ id: 42, number: 7 });
    deps.applyRepPenalty.mockResolvedValue(-140);

    const service = new ModerationService(deps);
    const result = await service.applyWarn("g1", "u1", "m1", "spam", 7);

    expect(deps.incrementCaseCounter).toHaveBeenCalledTimes(1);
    expect(deps.incrementCaseCounter).toHaveBeenCalledWith("g1");
    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "WARN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "spam",
      points: 7,
      caseNumber: 7,
      automatic: false,
    });
    expect(deps.applyRepPenalty).toHaveBeenCalledTimes(1);
    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", -140);
    expect(result).toEqual({ caseNumber: 7, caseId: 42 });
  });

  it("applies -20 × points even for the minimum points value", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(1);
    deps.createCase.mockResolvedValue({ id: 1, number: 1 });
    deps.applyRepPenalty.mockResolvedValue(-20);

    const service = new ModerationService(deps);
    await service.applyWarn("g1", "u1", "m1", "late", 1);

    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", -20);
  });
});

describe("ModerationService.applyTimeout", () => {
  it("increments the counter, creates a TIMEOUT case with durationSec and applies a -50 rep penalty", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(5);
    deps.createCase.mockResolvedValue({ id: 51, number: 5 });
    deps.applyRepPenalty.mockResolvedValue(-50);

    const service = new ModerationService(deps);
    const result = await service.applyTimeout("g1", "u1", "m1", "spamming", 3600);

    expect(deps.incrementCaseCounter).toHaveBeenCalledWith("g1");
    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "TIMEOUT",
      targetId: "u1",
      moderatorId: "m1",
      reason: "spamming",
      durationSec: 3600,
      points: 0,
      caseNumber: 5,
      automatic: false,
    });
    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", -50);
    expect(result).toEqual({ caseNumber: 5, caseId: 51 });
  });
});

describe("ModerationService.applyKick", () => {
  it("increments the counter, creates a KICK case and applies a -50 rep penalty", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(8);
    deps.createCase.mockResolvedValue({ id: 81, number: 8 });
    deps.applyRepPenalty.mockResolvedValue(-50);

    const service = new ModerationService(deps);
    const result = await service.applyKick("g1", "u1", "m1", "harassment");

    expect(deps.incrementCaseCounter).toHaveBeenCalledWith("g1");
    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "KICK",
      targetId: "u1",
      moderatorId: "m1",
      reason: "harassment",
      points: 0,
      caseNumber: 8,
      automatic: false,
    });
    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", -50);
    expect(result).toEqual({ caseNumber: 8, caseId: 81 });
  });
});

describe("ModerationService.applyUnTimeout", () => {
  it("increments the counter and creates an UNTIMEOUT case with no rep penalty", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(6);
    deps.createCase.mockResolvedValue({ id: 60, number: 6 });

    const service = new ModerationService(deps);
    const result = await service.applyUnTimeout("g1", "u1", "m1", "appeal accepted");

    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "UNTIMEOUT",
      targetId: "u1",
      moderatorId: "m1",
      reason: "appeal accepted",
      points: 0,
      caseNumber: 6,
      automatic: false,
    });
    expect(deps.applyRepPenalty).not.toHaveBeenCalled();
    expect(result).toEqual({ caseNumber: 6, caseId: 60 });
  });
});

describe("ModerationService.parseDuration", () => {
  it("parses single units into seconds", () => {
    expect(ModerationService.parseDuration("30s")).toBe(30);
    expect(ModerationService.parseDuration("90m")).toBe(5400);
    expect(ModerationService.parseDuration("1h")).toBe(3600);
    expect(ModerationService.parseDuration("1d")).toBe(86400);
    expect(ModerationService.parseDuration("1w")).toBe(604800);
  });

  it("parses combined units", () => {
    expect(ModerationService.parseDuration("2h30m")).toBe(9000);
    expect(ModerationService.parseDuration("1d 2h")).toBe(93600);
    expect(ModerationService.parseDuration("1h15m30s")).toBe(4530);
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(ModerationService.parseDuration(" 2H 30M ")).toBe(9000);
  });

  it("returns 28 days in seconds", () => {
    expect(ModerationService.parseDuration("28d")).toBe(28 * 86400);
  });

  it("throws on empty input", () => {
    expect(() => ModerationService.parseDuration("")).toThrow(/Invalid duration/);
    expect(() => ModerationService.parseDuration("   ")).toThrow(/Invalid duration/);
  });

  it("throws on unparseable input", () => {
    expect(() => ModerationService.parseDuration("abc")).toThrow(/Invalid duration/);
    expect(() => ModerationService.parseDuration("10x")).toThrow(/Invalid duration/);
    expect(() => ModerationService.parseDuration("30")).toThrow(/Invalid duration/);
    expect(() => ModerationService.parseDuration("h30m")).toThrow(/Invalid duration/);
  });
});

describe("ModerationService.checkEscalation", () => {
  const ladder = ModerationService.getDefaultLadder("BALANCED");

  it("returns null when no ladder step applies to the active points", async () => {
    const deps = baseDeps();
    const service = new ModerationService(deps);
    const result = await service.checkEscalation("g1", "u1", 2, ladder, 30);
    expect(result).toBeNull();
    expect(deps.getLadderCasesInWindow).not.toHaveBeenCalled();
  });

  it("returns the highest applicable step that has not already been applied", async () => {
    const deps = baseDeps();
    deps.getLadderCasesInWindow.mockResolvedValue([]);
    const service = new ModerationService(deps);
    const result = await service.checkEscalation("g1", "u1", 8, ladder, 30);
    expect(result).toEqual({ points: 7, action: "KICK" });
  });

  it("skips a step already applied for that point total and returns the next lower one", async () => {
    const deps = baseDeps();
    deps.getLadderCasesInWindow.mockImplementation((_g, _t, points) => {
      if (points === 7) return Promise.resolve(["KICK"] as never[]);
      return Promise.resolve([]);
    });
    const service = new ModerationService(deps);
    const result = await service.checkEscalation("g1", "u1", 8, ladder, 30);
    expect(result).toEqual({ points: 5, action: "TIMEOUT", durationSec: 86400 });
  });

  it("returns null when every applicable step has already been applied", async () => {
    const deps = baseDeps();
    deps.getLadderCasesInWindow.mockResolvedValue(["TIMEOUT", "KICK", "BAN"] as never[]);
    const service = new ModerationService(deps);
    const result = await service.checkEscalation("g1", "u1", 10, ladder, 30);
    expect(result).toBeNull();
  });
});

describe("ModerationService.applyEscalation", () => {
  it("creates an automatic case referencing the warn with ruleKey ladder:<points>", async () => {
    const deps = baseDeps();
    deps.createCase.mockResolvedValue({ id: 9, number: 11 });
    const service = new ModerationService(deps);
    const result = await service.applyEscalation("g1", "u1", "bot", 4, { points: 7, action: "KICK" });

    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "KICK",
      targetId: "u1",
      moderatorId: "bot",
      reason: "Escalation (ladder 7 points) from warn #4",
      points: 7,
      durationSec: undefined,
      automatic: true,
      ruleKey: "ladder:7",
      caseNumber: 4,
    });
    expect(result).toEqual({ caseNumber: 11, caseId: 9 });
  });
});

describe("ModerationService.createCase", () => {
  it("increments the counter and creates the case with the returned number", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(3);
    const service = new ModerationService(deps);
    const result = await service.createCase({
      guildId: "g1",
      type: "WARN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "r",
      points: 2,
    });

    expect(deps.incrementCaseCounter).toHaveBeenCalledWith("g1");
    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "WARN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "r",
      points: 2,
      caseNumber: 3,
    });
    expect(result).toEqual({ caseNumber: 3 });
  });
});

describe("ModerationService.getDefaultLadder", () => {
  it("RELAXED", () => {
    expect(ModerationService.getDefaultLadder("RELAXED")).toEqual([
      { points: 5, action: "TIMEOUT", durationSec: 3600 },
      { points: 8, action: "KICK" },
    ]);
  });
  it("BALANCED", () => {
    expect(ModerationService.getDefaultLadder("BALANCED")).toEqual([
      { points: 3, action: "TIMEOUT", durationSec: 3600 },
      { points: 5, action: "TIMEOUT", durationSec: 86400 },
      { points: 7, action: "KICK" },
      { points: 9, action: "BAN" },
    ]);
  });
  it("STRICT", () => {
    expect(ModerationService.getDefaultLadder("STRICT")).toEqual([
      { points: 2, action: "TIMEOUT", durationSec: 21600 },
      { points: 3, action: "KICK" },
      { points: 4, action: "BAN" },
    ]);
  });
  it("LOCKDOWN", () => {
    expect(ModerationService.getDefaultLadder("LOCKDOWN")).toEqual([
      { points: 2, action: "KICK" },
      { points: 3, action: "BAN" },
    ]);
  });
  it("returns an empty ladder for an unknown strictness", () => {
    expect(ModerationService.getDefaultLadder("UNKNOWN" as any)).toEqual([]);
  });
});
