import { describe, it, expect, vi } from "vitest";
import { ModerationService } from "./service.js";

const baseDeps = () => ({
  incrementCaseCounter: vi.fn(),
  createCase: vi.fn(),
  applyRepPenalty: vi.fn(),
  getActiveWarnPoints: vi.fn(),
  getLadderCasesInWindow: vi.fn(),
  findCase: vi.fn(),
  undoCase: vi.fn(),
  getUserCases: vi.fn(),
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

describe("ModerationService.applyBan", () => {
  it("increments the counter, creates a BAN case and applies a -100 rep penalty", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(9);
    deps.createCase.mockResolvedValue({ id: 91, number: 9 });
    deps.applyRepPenalty.mockResolvedValue(-100);

    const service = new ModerationService(deps);
    const result = await service.applyBan("g1", "u1", "m1", "raiding");

    expect(deps.incrementCaseCounter).toHaveBeenCalledTimes(1);
    expect(deps.incrementCaseCounter).toHaveBeenCalledWith("g1");
    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "BAN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "raiding",
      durationSec: undefined,
      points: 0,
      caseNumber: 9,
      automatic: false,
    });
    expect(deps.applyRepPenalty).toHaveBeenCalledTimes(1);
    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", -100);
    expect(result).toEqual({ caseNumber: 9, caseId: 91, type: "BAN", durationSec: undefined });
  });

  it("creates a TEMPBAN case with durationSec and applies a -100 rep penalty", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter.mockResolvedValue(3);
    deps.createCase.mockResolvedValue({ id: 31, number: 3 });
    deps.applyRepPenalty.mockResolvedValue(-100);

    const service = new ModerationService(deps);
    const result = await service.applyBan("g1", "u1", "m1", "spam", 3600);

    expect(deps.incrementCaseCounter).toHaveBeenCalledWith("g1");
    expect(deps.createCase).toHaveBeenCalledWith({
      guildId: "g1",
      type: "TEMPBAN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "spam",
      durationSec: 3600,
      points: 0,
      caseNumber: 3,
      automatic: false,
    });
    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", -100);
    expect(result).toEqual({ caseNumber: 3, caseId: 31, type: "TEMPBAN", durationSec: 3600 });
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

describe("ModerationService.applyMassBan", () => {
  it("increments the counter for each user, creates BAN cases, applies -100 rep penalty each, and returns results", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(12);
    deps.createCase
      .mockResolvedValueOnce({ id: 100, number: 10 })
      .mockResolvedValueOnce({ id: 101, number: 11 })
      .mockResolvedValueOnce({ id: 102, number: 12 });
    deps.applyRepPenalty.mockResolvedValue(-100);

    const service = new ModerationService(deps);
    const result = await service.applyMassBan("g1", ["u1", "u2", "u3"], "m1", "raiding");

    expect(deps.incrementCaseCounter).toHaveBeenCalledTimes(3);
    expect(deps.incrementCaseCounter).toHaveBeenNthCalledWith(1, "g1");
    expect(deps.incrementCaseCounter).toHaveBeenNthCalledWith(2, "g1");
    expect(deps.incrementCaseCounter).toHaveBeenNthCalledWith(3, "g1");

    expect(deps.createCase).toHaveBeenCalledTimes(3);
    expect(deps.createCase).toHaveBeenNthCalledWith(1, {
      guildId: "g1",
      type: "BAN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "raiding",
      points: 0,
      caseNumber: 10,
      automatic: false,
    });
    expect(deps.createCase).toHaveBeenNthCalledWith(2, {
      guildId: "g1",
      type: "BAN",
      targetId: "u2",
      moderatorId: "m1",
      reason: "raiding",
      points: 0,
      caseNumber: 11,
      automatic: false,
    });
    expect(deps.createCase).toHaveBeenNthCalledWith(3, {
      guildId: "g1",
      type: "BAN",
      targetId: "u3",
      moderatorId: "m1",
      reason: "raiding",
      points: 0,
      caseNumber: 12,
      automatic: false,
    });

    expect(deps.applyRepPenalty).toHaveBeenCalledTimes(3);
    expect(deps.applyRepPenalty).toHaveBeenNthCalledWith(1, "g1", "u1", -100);
    expect(deps.applyRepPenalty).toHaveBeenNthCalledWith(2, "g1", "u2", -100);
    expect(deps.applyRepPenalty).toHaveBeenNthCalledWith(3, "g1", "u3", -100);

    expect(result).toEqual({
      caseNumbers: [10, 11, 12],
      caseIds: [100, 101, 102],
      bannedUserIds: ["u1", "u2", "u3"],
      failedUserIds: [],
    });
  });

  it("tracks failed users when createCase throws", async () => {
    const deps = baseDeps();
    deps.incrementCaseCounter
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11);
    deps.createCase
      .mockResolvedValueOnce({ id: 100, number: 10 })
      .mockRejectedValueOnce(new Error("DB error"));
    deps.applyRepPenalty.mockResolvedValue(-100);

    const service = new ModerationService(deps);
    const result = await service.applyMassBan("g1", ["u1", "u2"], "m1", "raiding");

    expect(deps.incrementCaseCounter).toHaveBeenCalledTimes(2);
    expect(deps.createCase).toHaveBeenCalledTimes(2);
    expect(deps.applyRepPenalty).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      caseNumbers: [10],
      caseIds: [100],
      bannedUserIds: ["u1"],
      failedUserIds: ["u2"],
    });
  });

  it("handles empty target list", async () => {
    const deps = baseDeps();
    const service = new ModerationService(deps);
    const result = await service.applyMassBan("g1", [], "m1", "raiding");

    expect(deps.incrementCaseCounter).not.toHaveBeenCalled();
    expect(deps.createCase).not.toHaveBeenCalled();
    expect(deps.applyRepPenalty).not.toHaveBeenCalled();
    expect(result).toEqual({
      caseNumbers: [],
      caseIds: [],
      bannedUserIds: [],
      failedUserIds: [],
    });
  });
});

describe("ModerationService.undoCase (§10.4)", () => {
  const baseCase = {
    id: 1,
    number: 5,
    type: "WARN",
    targetId: "u1",
    moderatorId: "m1",
    reason: "spam",
    durationSec: null,
    points: 3,
    undone: false,
    undoneBy: null,
    undoneAt: null,
    logMessageId: null,
    createdAt: new Date(),
  };

  it("undoes a WARN case, restores +20 × points rep, and returns case info", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue(baseCase);
    deps.undoCase.mockResolvedValue(undefined);
    deps.applyRepPenalty.mockResolvedValue(60);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 5, "m2");

    expect(deps.findCase).toHaveBeenCalledWith("g1", 5);
    expect(deps.undoCase).toHaveBeenCalledWith("g1", 5, "m2");
    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", 60);
    expect(result).toEqual({ type: "WARN", targetId: "u1", points: 3 });
  });

  it("undoes a TIMEOUT case and restores +50 rep", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue({ ...baseCase, type: "TIMEOUT", points: 0 });
    deps.undoCase.mockResolvedValue(undefined);
    deps.applyRepPenalty.mockResolvedValue(50);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 6, "m2");

    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", 50);
    expect(result).toEqual({ type: "TIMEOUT", targetId: "u1", points: 0 });
  });

  it("undoes a KICK case and restores +50 rep", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue({ ...baseCase, type: "KICK", points: 0 });
    deps.undoCase.mockResolvedValue(undefined);
    deps.applyRepPenalty.mockResolvedValue(50);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 7, "m2");

    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", 50);
    expect(result).toEqual({ type: "KICK", targetId: "u1", points: 0 });
  });

  it("undoes a BAN case and restores +100 rep", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue({ ...baseCase, type: "BAN", points: 0 });
    deps.undoCase.mockResolvedValue(undefined);
    deps.applyRepPenalty.mockResolvedValue(100);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 8, "m2");

    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", 100);
    expect(result).toEqual({ type: "BAN", targetId: "u1", points: 0 });
  });

  it("undoes a TEMPBAN case and restores +100 rep", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue({ ...baseCase, type: "TEMPBAN", points: 0, durationSec: 3600 });
    deps.undoCase.mockResolvedValue(undefined);
    deps.applyRepPenalty.mockResolvedValue(100);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 9, "m2");

    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", 100);
    expect(result).toEqual({ type: "TEMPBAN", targetId: "u1", points: 0, durationSec: 3600 });
  });

  it("undoes a SOFTBAN case and restores +100 rep", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue({ ...baseCase, type: "SOFTBAN", points: 0 });
    deps.undoCase.mockResolvedValue(undefined);
    deps.applyRepPenalty.mockResolvedValue(100);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 10, "m2");

    expect(deps.applyRepPenalty).toHaveBeenCalledWith("g1", "u1", 100);
    expect(result).toEqual({ type: "SOFTBAN", targetId: "u1", points: 0 });
  });

  it("returns null when case not found and does not call undoCase", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue(null);

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 999, "m2");

    expect(deps.findCase).toHaveBeenCalledWith("g1", 999);
    expect(deps.undoCase).not.toHaveBeenCalled();
    expect(deps.applyRepPenalty).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("returns null when case is already undone and does not call undoCase or applyRepPenalty", async () => {
    const deps = baseDeps();
    deps.findCase.mockResolvedValue({ ...baseCase, undone: true, undoneBy: "m3", undoneAt: new Date() });

    const service = new ModerationService(deps);
    const result = await service.undoCase("g1", 5, "m2");

    expect(deps.findCase).toHaveBeenCalledWith("g1", 5);
    expect(deps.undoCase).not.toHaveBeenCalled();
    expect(deps.applyRepPenalty).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
