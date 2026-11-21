import { describe, it, expect, vi } from "vitest";
import {
  recordChange,
  getHistory,
  undoChange,
  publishConfigChanged,
  type ConfigHistoryRow,
  type HistoryPrisma,
  type RedisPublisher,
} from "./history.js";

function makeRow(over: Partial<ConfigHistoryRow> = {}): ConfigHistoryRow {
  return {
    id: 1,
    guildId: "g1",
    actorId: "u1",
    source: "settings",
    path: "overrides.automod.spam.maxMessages",
    oldValue: 7,
    newValue: 5,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

function makePrisma(over: Partial<HistoryPrisma["configHistory"]> = {}): {
  prisma: HistoryPrisma;
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async ({ data }: { data: unknown }) => makeRow({ id: 99, ...(data as object) }));
  const findMany = vi.fn(async () => [] as ConfigHistoryRow[]);
  const findUnique = vi.fn(async () => null as ConfigHistoryRow | null);
  const prisma: HistoryPrisma = {
    configHistory: { create, findMany, findUnique, ...over },
  };
  return { prisma, create, findMany, findUnique };
}

describe("recordChange", () => {
  it("creates a row with the correct fields", async () => {
    const { prisma, create } = makePrisma();
    const result = await recordChange(prisma, {
      guildId: "g1",
      actorId: "u1",
      source: "settings",
      path: "overrides.automod.spam.maxMessages",
      oldValue: 7,
      newValue: 5,
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        guildId: "g1",
        actorId: "u1",
        source: "settings",
        path: "overrides.automod.spam.maxMessages",
        oldValue: 7,
        newValue: 5,
      },
    });
    expect(result.id).toBe(99);
  });

  it("omits undefined JSON values from the create payload", async () => {
    const { prisma, create } = makePrisma();
    await recordChange(prisma, {
      guildId: "g1",
      actorId: "system",
      source: "auto",
      path: "modules.automod",
      newValue: false,
    });

    const arg = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data).not.toHaveProperty("oldValue");
    expect(arg.data["newValue"]).toBe(false);
  });
});

describe("getHistory", () => {
  it("queries by guild, newest first, with default limit 25", async () => {
    const { prisma, findMany } = makePrisma();
    findMany.mockResolvedValueOnce([makeRow({ id: 2 }), makeRow({ id: 1 })]);

    const rows = await getHistory(prisma, "g1");

    expect(findMany).toHaveBeenCalledWith({
      where: { guildId: "g1" },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
  });

  it("honours a custom limit", async () => {
    const { prisma, findMany } = makePrisma();
    await getHistory(prisma, "g1", 5);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });
});

describe("undoChange", () => {
  it("writes a new row with source 'undo' restoring the old value", async () => {
    const original = makeRow({ id: 7, guildId: "g1", oldValue: 10, newValue: 4 });
    const { prisma, create } = makePrisma({ findUnique: vi.fn(async () => original) });

    const result = await undoChange(prisma, 7, "u2");

    expect(create).toHaveBeenCalledWith({
      data: {
        guildId: "g1",
        actorId: "u2",
        source: "undo",
        path: original.path,
        oldValue: 4,
        newValue: 10,
      },
    });
    expect(result).toEqual({
      historyId: 99,
      path: original.path,
      oldValue: 10,
    });
  });

  it("throws when the history row does not exist", async () => {
    const { prisma, create } = makePrisma({ findUnique: vi.fn(async () => null) });
    await expect(undoChange(prisma, 123, "u2")).rejects.toThrow(/not found/i);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("publishConfigChanged", () => {
  it("publishes '1' to the config:changed channel", async () => {
    const publish = vi.fn(async () => 1);
    const redis: RedisPublisher = { publish };

    await publishConfigChanged(redis, "g1");

    expect(publish).toHaveBeenCalledWith("config:changed:g1", "1");
  });
});