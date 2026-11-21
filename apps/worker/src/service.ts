export type CaseExpireType = "TEMPBAN" | "TIMEOUT";

export interface ExpiredCase {
  id: number;
  guildId: string;
  targetId: string;
  type: CaseExpireType;
  expiresAt: Date;
  undone: boolean;
}

export interface ExpiryLogger {
  error(ctx: { service?: string; event?: string }, message: string, err?: Error): void;
  info(ctx: { service?: string; event?: string }, message: string): void;
}

export interface ExpiryDeps {
  findExpiredCases: () => Promise<ExpiredCase[]>;
  findCaseById: (caseId: number) => Promise<ExpiredCase | null>;
  markCaseUndone: (caseId: number) => Promise<void>;
  performExpiry: (params: {
    type: CaseExpireType;
    guildId: string;
    targetId: string;
    reason: string;
  }) => Promise<void>;
  logger: ExpiryLogger;
}

export interface ExpiryResult {
  processed: number;
  succeeded: number;
  failed: number;
}

const EXPIRY_REASON = "Temporary moderation action expired";

export class CaseExpiryService {
  public readonly deps: ExpiryDeps;

  constructor(deps: ExpiryDeps) {
    this.deps = deps;
  }

  static selectDueCases(cases: ExpiredCase[], now: Date): ExpiredCase[] {
    return cases.filter((c) => !c.undone && c.expiresAt.getTime() < now.getTime());
  }

  async expireCase(c: ExpiredCase): Promise<void> {
    const fresh = await this.deps.findCaseById(c.id);
    if (!fresh || fresh.undone) {
      return;
    }
    if (fresh.expiresAt.getTime() >= Date.now()) {
      return;
    }

    try {
      await this.deps.performExpiry({
        type: fresh.type,
        guildId: fresh.guildId,
        targetId: fresh.targetId,
        reason: EXPIRY_REASON,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.deps.logger.error(
        { service: "worker", event: "case-expiry:discord-action-failed" },
        `Discord expiry action failed for case ${fresh.id} (${fresh.type})`,
        error,
      );
    }

    await this.deps.markCaseUndone(fresh.id);
  }

  async runRecoverySweep(): Promise<ExpiryResult> {
    const now = new Date();
    const all = await this.deps.findExpiredCases();
    const due = CaseExpiryService.selectDueCases(all, now);

    let succeeded = 0;
    let failed = 0;
    for (const c of due) {
      try {
        await this.expireCase(c);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed: due.length, succeeded, failed };
  }
}
