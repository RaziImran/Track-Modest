import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@modest/db";
import {
  applyRepPenalty,
  getActiveWarnPoints,
  getLadderCasesInWindow,
  setCaseLogMessageId,
  incrementCaseCounter,
  createCase,
} from "./repository.js";

vi.mock("@modest/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    caseCounter: { upsert: vi.fn() },
    case: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    member: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
});

describe("repository.applyRepPenalty (§20.4)", () => {
  it("applies a negative delta and resets cleanSince", async () => {
    (prisma.member.findUnique as any).mockResolvedValue({ rep: 100 });
    (prisma.member.upsert as any).mockResolvedValue({});
    const result = await applyRepPenalty("g1", "u1", -20);
    expect(prisma.member.upsert).toHaveBeenCalledWith({
      where: { guildId_userId: { guildId: "g1", userId: "u1" } },
      update: { rep: 80, cleanSince: expect.any(Date) },
      create: { guildId: "g1", userId: "u1", rep: 80, cleanSince: expect.any(Date) },
    });
    expect(result).toBe(80);
  });

  it("clamps rep at -500 (floor)", async () => {
    (prisma.member.findUnique as any).mockResolvedValue({ rep: -490 });
    (prisma.member.upsert as any).mockResolvedValue({});
    const result = await applyRepPenalty("g1", "u1", -30);
    expect(prisma.member.upsert).toHaveBeenCalledWith({
      where: { guildId_userId: { guildId: "g1", userId: "u1" } },
      update: { rep: -500, cleanSince: expect.any(Date) },
      create: { guildId: "g1", userId: "u1", rep: -500, cleanSince: expect.any(Date) },
    });
    expect(result).toBe(-500);
  });

  it("clamps when rep already at the floor and no member row exists yet", async () => {
    (prisma.member.findUnique as any).mockResolvedValue(null);
    (prisma.member.upsert as any).mockResolvedValue({});
    const result = await applyRepPenalty("g1", "u1", -1000);
    expect(result).toBe(-500);
    expect((prisma.member.upsert as any).mock.calls[0][0].create.rep).toBe(-500);
  });
});

describe("repository.getActiveWarnPoints", () => {
  it("sums non-undone WARN points within the expiry window", async () => {
    (prisma.case.findMany as any).mockResolvedValue([{ points: 2 }, { points: 3 }]);
    const result = await getActiveWarnPoints("g1", "u1", 30);
    expect(result).toBe(5);
    expect(prisma.case.findMany).toHaveBeenCalledWith({
      where: {
        guildId: "g1",
        targetId: "u1",
        type: "WARN",
        undone: false,
        createdAt: { gt: expect.any(Date) },
      },
      select: { points: true },
    });
  });
});

describe("repository.getLadderCasesInWindow", () => {
  it("returns case types for the ladder ruleKey in the window", async () => {
    (prisma.case.findMany as any).mockResolvedValue([{ type: "KICK" }, { type: "BAN" }]);
    const result = await getLadderCasesInWindow("g1", "u1", 7, 30);
    expect(result).toEqual(["KICK", "BAN"]);
    expect(prisma.case.findMany).toHaveBeenCalledWith({
      where: { guildId: "g1", targetId: "u1", ruleKey: "ladder:7", createdAt: { gt: expect.any(Date) } },
      select: { type: true },
    });
  });
});

describe("repository.setCaseLogMessageId", () => {
  it("updates logMessageId for the case number", async () => {
    (prisma.case.updateMany as any).mockResolvedValue({ count: 1 });
    await setCaseLogMessageId("g1", 4, "msg-123");
    expect(prisma.case.updateMany).toHaveBeenCalledWith({
      where: { guildId: "g1", number: 4 },
      data: { logMessageId: "msg-123" },
    });
  });
});

describe("repository.incrementCaseCounter", () => {
  it("atomically increments and returns the reserved number", async () => {
    (prisma.caseCounter.upsert as any).mockResolvedValue({ next: 6 });
    const result = await incrementCaseCounter("g1");
    expect(result).toBe(5);
    expect(prisma.caseCounter.upsert).toHaveBeenCalledWith({
      where: { guildId: "g1" },
      update: { next: { increment: 1 } },
      create: { guildId: "g1", next: 2 },
    });
  });
});

describe("repository.createCase", () => {
  it("creates the case and returns id and number", async () => {
    (prisma.case.create as any).mockResolvedValue({ id: 42, number: 7 });
    const result = await createCase({
      guildId: "g1",
      type: "WARN",
      targetId: "u1",
      moderatorId: "m1",
      reason: "r",
      points: 2,
      caseNumber: 7,
    });
    expect(result).toEqual({ id: 42, number: 7 });
    expect(prisma.case.create).toHaveBeenCalledWith({
      data: {
        guildId: "g1",
        number: 7,
        type: "WARN",
        targetId: "u1",
        moderatorId: "m1",
        reason: "r",
        durationSec: undefined,
        automatic: false,
        ruleKey: undefined,
        points: 2,
      },
      select: { id: true, number: true },
    });
  });
});
