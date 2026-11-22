import { prisma } from "@modest/db";
import type { Strictness } from "@modest/config-engine";

export interface TemporaryBoostRow {
  id: number;
  guildId: string;
  strictness: Strictness;
  reason: string;
  startedBy: string;
  endsAt: Date;
  createdAt: Date;
}

/** §8.10 — Create a temporary strictness boost row. */
export async function createTemporaryBoost(input: {
  guildId: string;
  strictness: Strictness;
  reason: string;
  startedBy: string;
  endsAt: Date;
}): Promise<TemporaryBoostRow> {
  const row = await prisma.temporaryBoost.create({
    data: {
      guildId: input.guildId,
      strictness: input.strictness,
      reason: input.reason,
      startedBy: input.startedBy,
      endsAt: input.endsAt,
    },
  });
  return {
    id: row.id,
    guildId: row.guildId,
    strictness: row.strictness as Strictness,
    reason: row.reason,
    startedBy: row.startedBy,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}

/** §8.10 — Get the currently active temporary boost for a guild, if any. */
export async function getActiveTemporaryBoost(
  guildId: string,
): Promise<TemporaryBoostRow | null> {
  const now = new Date();
  const row = await prisma.temporaryBoost.findFirst({
    where: {
      guildId,
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guildId,
    strictness: row.strictness as Strictness,
    reason: row.reason,
    startedBy: row.startedBy,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}

/** §8.10 — End a temporary boost early by deleting its row. */
export async function endTemporaryBoost(guildId: string): Promise<boolean> {
  const deleted = await prisma.temporaryBoost.deleteMany({
    where: {
      guildId,
      endsAt: { gt: new Date() },
    },
  });
  return deleted.count > 0;
}
