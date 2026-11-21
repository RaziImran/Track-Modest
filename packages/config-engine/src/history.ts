// Config history & undo service (§8.7).
// Pure service layer: NO discord.js imports. All I/O is injected so this module
// is unit-testable without a real database or Redis.

/** Provenance of a config change. "undo" is written when a change is reverted. */
export type ConfigSource =
  | "wizard"
  | "settings"
  | "dashboard"
  | "assistant"
  | "auto"
  | "undo";

/** A single ConfigHistory row as consumed by this service. */
export interface ConfigHistoryRow {
  id: number;
  guildId: string;
  actorId: string;
  source: string;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
}

/** Shape written to configHistory.create. JSON values are optional. */
export interface ConfigHistoryCreateInput {
  guildId: string;
  actorId: string;
  source: string;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Minimal Prisma surface used by this service.
 * The real @modest/db PrismaClient satisfies this structurally; tests inject mocks.
 */
export interface HistoryPrisma {
  configHistory: {
    create(args: { data: ConfigHistoryCreateInput }): Promise<ConfigHistoryRow>;
    findMany(args: {
      where: { guildId: string };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<ConfigHistoryRow[]>;
    findUnique(args: { where: { id: number } }): Promise<ConfigHistoryRow | null>;
  };
}

/** Minimal Redis publisher surface (node-redis / ioredis compatible). */
export interface RedisPublisher {
  publish(channel: string, message: string): unknown;
}

/** Input for {@link recordChange}. */
export interface RecordChangeInput {
  guildId: string;
  actorId: string;
  source: ConfigSource;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Result of {@link undoChange}. */
export interface UndoResult {
  /** id of the newly written "undo" history row. */
  historyId: number;
  path: string;
  /** The value that was restored (the original row's oldValue). */
  oldValue: unknown;
}

/**
 * Append a ConfigHistory row for a config change (§8.7).
 * Every change — whatever its source — must be recorded here.
 */
export async function recordChange(
  prisma: HistoryPrisma,
  input: RecordChangeInput,
): Promise<ConfigHistoryRow> {
  const data: ConfigHistoryCreateInput = {
    guildId: input.guildId,
    actorId: input.actorId,
    source: input.source,
    path: input.path,
  };
  if (input.oldValue !== undefined) {
    data.oldValue = input.oldValue;
  }
  if (input.newValue !== undefined) {
    data.newValue = input.newValue;
  }
  return prisma.configHistory.create({ data });
}

/**
 * Return the most recent ConfigHistory rows for a guild, newest first.
 * Defaults to the 25 entries shown by `/settings history`.
 */
export async function getHistory(
  prisma: HistoryPrisma,
  guildId: string,
  limit = 25,
): Promise<ConfigHistoryRow[]> {
  return prisma.configHistory.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Revert a change by writing its oldValue back as a new history row.
 * The new row records the replaced value as its oldValue and source "undo",
 * preserving a full audit trail. Returns the restored path and value.
 */
export async function undoChange(
  prisma: HistoryPrisma,
  historyId: number,
  actorId: string,
): Promise<UndoResult> {
  const row = await prisma.configHistory.findUnique({ where: { id: historyId } });
  if (!row) {
    throw new Error(`ConfigHistory row not found: ${historyId}`);
  }

  const undone = await prisma.configHistory.create({
    data: {
      guildId: row.guildId,
      actorId,
      source: "undo",
      path: row.path,
      oldValue: row.newValue ?? undefined,
      newValue: row.oldValue ?? undefined,
    },
  });

  return { historyId: undone.id, path: row.path, oldValue: row.oldValue };
}

/**
 * Notify every service that a guild's config changed so they invalidate their
 * `cfg:{guildId}` cache. Redis is injected so callers/tests control the client.
 */
export async function publishConfigChanged(
  redis: RedisPublisher,
  guildId: string,
): Promise<void> {
  await redis.publish(`config:changed:${guildId}`, "1");
}