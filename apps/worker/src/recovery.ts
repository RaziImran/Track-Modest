import { CaseExpiryService, type ExpiryDeps, type ExpiryResult, type ExpiredCase } from "./service.js";

export interface DiscordAdapter {
  performExpiry(params: {
    type: ExpiredCase["type"];
    guildId: string;
    targetId: string;
    reason: string;
  }): Promise<void>;
}

function toExpiredCase(row: unknown): ExpiredCase {
  const r = row as {
    id: unknown;
    guildId: unknown;
    targetId: unknown;
    type: unknown;
    expiresAt: unknown;
    undone: unknown;
  };
  return {
    id: Number(r.id),
    guildId: String(r.guildId),
    targetId: String(r.targetId),
    type: r.type as ExpiredCase["type"],
    expiresAt: r.expiresAt instanceof Date ? r.expiresAt : new Date(String(r.expiresAt)),
    undone: Boolean(r.undone),
  };
}

export function buildRecoveryDeps(
  prisma: any,
  discord: DiscordAdapter,
  logger: ExpiryDeps["logger"],
): ExpiryDeps {
  return {
    findExpiredCases: async (): Promise<ExpiredCase[]> => {
      const now = new Date();
      const rows = await prisma.case.findMany({
        where: {
          expiresAt: { lt: now },
          undone: false,
          type: { in: ["TEMPBAN", "TIMEOUT"] },
        },
      });
      return rows.map((row: unknown) => toExpiredCase(row));
    },
    findCaseById: async (caseId: number): Promise<ExpiredCase | null> => {
      const row = await prisma.case.findUnique({ where: { id: caseId } });
      if (!row) {
        return null;
      }
      return toExpiredCase(row);
    },
    markCaseUndone: async (caseId: number): Promise<void> => {
      await prisma.case.update({
        where: { id: caseId },
        data: { undone: true, undoneAt: new Date() },
      });
    },
    performExpiry: discord.performExpiry,
    logger,
  };
}

export async function runRecoverySweep(deps: ExpiryDeps): Promise<ExpiryResult> {
  return new CaseExpiryService(deps).runRecoverySweep();
}
