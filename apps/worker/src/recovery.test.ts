import { describe, it, expect, vi } from "vitest";
import { buildRecoveryDeps, runRecoverySweep, type DiscordAdapter } from "./recovery.js";
import type { ExpiredCase, ExpiryDeps } from "./service.js";

const prismaRow = {
  id: 5,
  guildId: "g1",
  targetId: "u1",
  type: "TEMPBAN",
  expiresAt: new Date("2025-01-01T00:00:00Z"),
  undone: false,
};

const buildPrisma = () => ({
  case: {
    findMany: vi.fn<(args: unknown) => Promise<unknown[]>>().mockResolvedValue([prismaRow]),
    findUnique: vi.fn<(args: unknown) => Promise<unknown>>().mockResolvedValue(prismaRow),
    update: vi.fn<(args: unknown) => Promise<unknown>>().mockResolvedValue({}),
  },
});

const buildDiscord = (): DiscordAdapter =>
  ({ performExpiry: vi.fn() } as unknown as DiscordAdapter);

const buildLogger = () => ({ error: vi.fn(), info: vi.fn() });

describe("buildRecoveryDeps", () => {
  it("maps prisma rows to ExpiredCase", async () => {
    const prisma = buildPrisma();
    const deps = buildRecoveryDeps(prisma, buildDiscord(), buildLogger());

    const cases = await deps.findExpiredCases();

    expect(cases).toHaveLength(1);
    expect(cases[0]!).toMatchObject({ id: 5, guildId: "g1", targetId: "u1", type: "TEMPBAN", undone: false });
    expect(cases[0]!.expiresAt instanceof Date).toBe(true);
    expect(prisma.case.findMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
        undone: false,
        type: { in: ["TEMPBAN", "TIMEOUT"] },
      },
    });
  });

  it("findCaseById returns the mapped case or null", async () => {
    const prisma = buildPrisma();
    const deps = buildRecoveryDeps(prisma, buildDiscord(), buildLogger());

    const found = await deps.findCaseById(5);
    expect(found).not.toBeNull();
    expect(found!).toMatchObject({ id: 5, type: "TEMPBAN" });

    prisma.case.findUnique.mockResolvedValue(null);
    const missing = await deps.findCaseById(99);
    expect(missing).toBeNull();
  });

  it("markCaseUndone updates the case", async () => {
    const prisma = buildPrisma();
    const deps = buildRecoveryDeps(prisma, buildDiscord(), buildLogger());

    await deps.markCaseUndone(5);

    expect(prisma.case.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { undone: true, undoneAt: expect.any(Date) },
    });
  });

  it("wires performExpiry to the discord adapter", async () => {
    const discord = buildDiscord();
    const deps = buildRecoveryDeps(buildPrisma(), discord, buildLogger());

    await deps.performExpiry({ type: "TIMEOUT", guildId: "g1", targetId: "u1", reason: "r" });

    expect(discord.performExpiry).toHaveBeenCalledWith({
      type: "TIMEOUT",
      guildId: "g1",
      targetId: "u1",
      reason: "r",
    });
  });
});

describe("runRecoverySweep", () => {
  it("delegates to the service and returns the result", async () => {
    const deps: ExpiryDeps = {
      findExpiredCases: vi.fn<() => Promise<ExpiredCase[]>>().mockResolvedValue([]),
      findCaseById: vi.fn<(caseId: number) => Promise<ExpiredCase | null>>(),
      markCaseUndone: vi.fn<(caseId: number) => Promise<void>>(),
      performExpiry: vi.fn<(params: { type: "TEMPBAN" | "TIMEOUT"; guildId: string; targetId: string; reason: string }) => Promise<void>>(),
      logger: buildLogger(),
    };

    const result = await runRecoverySweep(deps);

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(deps.findExpiredCases).toHaveBeenCalledTimes(1);
  });
});
