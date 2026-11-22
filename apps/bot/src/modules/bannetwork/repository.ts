// §15.5 Shared ban network repository — Prisma operations.
import { prisma } from "@modest/db";
import type { BanNetworkServiceDeps, BanListEntryRow } from "./service.js";

export interface BanNetworkRepositoryDeps {}

export class BanNetworkRepository {
  constructor(_deps: BanNetworkRepositoryDeps) {}

  async createEntry(input: {
    userId: string;
    sourceGuildId: string;
    category: string;
    evidence: string;
  }): Promise<BanListEntryRow> {
    const row = await prisma.banListEntry.create({
      data: {
        userId: input.userId,
        sourceGuildId: input.sourceGuildId,
        category: input.category,
        evidence: input.evidence,
        confirmedBy: 1,
        status: "pending",
      },
    });
    return mapRow(row);
  }

  async findEntryByUserCategory(userId: string, category: string): Promise<BanListEntryRow | null> {
    const row = await prisma.banListEntry.findFirst({
      where: { userId, category },
    });
    return row ? mapRow(row) : null;
  }

  async findActiveEntryByUserId(userId: string): Promise<BanListEntryRow | null> {
    const row = await prisma.banListEntry.findFirst({
      where: { userId, status: "active" },
    });
    return row ? mapRow(row) : null;
  }

  async incrementConfirmation(id: number): Promise<BanListEntryRow> {
    const row = await prisma.banListEntry.update({
      where: { id },
      data: { confirmedBy: { increment: 1 } },
    });
    return mapRow(row);
  }

  async setStatus(id: number, status: string): Promise<void> {
    await prisma.banListEntry.update({ where: { id }, data: { status } });
  }

  async getActiveEntries(): Promise<BanListEntryRow[]> {
    const rows = await prisma.banListEntry.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRow);
  }

  async isNetworkEnabled(guildId: string): Promise<boolean> {
    const row = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { overrides: true },
    });
    return (row?.overrides as Record<string, unknown> | null)?.["network.enabled"] === true;
  }

  async getJoinAction(guildId: string): Promise<"alert" | "require_verification" | "ban"> {
    const row = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { overrides: true },
    });
    return (
      ((row?.overrides as Record<string, unknown> | null)?.["network.joinAction"] as
        | "alert"
        | "require_verification"
        | "ban") ?? "alert"
    );
  }

  /** Create the service deps from this repository. */
  static createServiceDeps(repo: BanNetworkRepository): BanNetworkServiceDeps {
    return {
      createEntry: (input) => repo.createEntry(input),
      findEntryByUserCategory: (userId, category) => repo.findEntryByUserCategory(userId, category),
      findActiveEntryByUserId: (userId) => repo.findActiveEntryByUserId(userId),
      incrementConfirmation: (id) => repo.incrementConfirmation(id),
      setStatus: (id, status) => repo.setStatus(id, status),
      getActiveEntries: () => repo.getActiveEntries(),
      isNetworkEnabled: (guildId) => repo.isNetworkEnabled(guildId),
      getJoinAction: (guildId) => repo.getJoinAction(guildId),
    };
  }
}

function mapRow(row: any): BanListEntryRow {
  return {
    id: row.id,
    userId: row.userId,
    sourceGuildId: row.sourceGuildId,
    category: row.category,
    evidence: row.evidence,
    confirmedBy: row.confirmedBy,
    status: row.status,
    createdAt: row.createdAt,
  };
}
