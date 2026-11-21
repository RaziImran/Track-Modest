export type ModCaseType = "WARN" | "TIMEOUT" | "UNTIMEOUT" | "KICK" | "BAN" | "UNBAN" | "SOFTBAN" | "TEMPBAN" | "NOTE_ONLY" | "PURGE" | "LOCK" | "UNLOCK";

export type ModStrictness = "RELAXED" | "BALANCED" | "STRICT" | "LOCKDOWN";

export interface ModCreateCaseInput {
  guildId: string;
  type: ModCaseType;
  targetId: string;
  moderatorId: string;
  reason?: string;
  durationSec?: number;
  automatic?: boolean;
  ruleKey?: string;
  points?: number;
}

export interface ModCaseResult {
  caseNumber: number;
}

export interface ModEscalationStep {
  points: number;
  action: ModCaseType;
  durationSec?: number;
}

export interface ModerationServiceDeps {
  incrementCaseCounter: (guildId: string) => Promise<number>;
  createCase: (input: ModCreateCaseInput & { caseNumber: number }) => Promise<{ id: number; number: number }>;
  addRepPoints?: (guildId: string, userId: string, delta: number) => Promise<void>;
  applyRepPenalty: (guildId: string, userId: string, delta: number) => Promise<number>;
  getActiveWarnPoints: (guildId: string, userId: string, expiryDays: number) => Promise<number>;
  getLadderCasesInWindow: (
    guildId: string,
    targetId: string,
    points: number,
    expiryDays: number,
  ) => Promise<ModCaseType[]>;
}

export class ModerationService {
  public deps: ModerationServiceDeps;

  constructor(deps: ModerationServiceDeps) {
    this.deps = deps;
  }

  async createCase(input: ModCreateCaseInput): Promise<ModCaseResult> {
    const caseNumber = await this.deps.incrementCaseCounter(input.guildId);
    await this.deps.createCase({ ...input, caseNumber });
    return { caseNumber };
  }

  async applyWarn(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
    points: number,
  ): Promise<{ caseNumber: number; caseId: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: "WARN",
      targetId,
      moderatorId,
      reason,
      points,
      caseNumber,
      automatic: false,
    });
    await this.deps.applyRepPenalty(guildId, targetId, -20 * points);
    return { caseNumber, caseId: created.id };
  }

  async checkEscalation(
    guildId: string,
    targetId: string,
    activePoints: number,
    ladder: ModEscalationStep[],
    expiryDays: number,
  ): Promise<ModEscalationStep | null> {
    const applicable = ladder.filter((step) => step.points <= activePoints);
    if (applicable.length === 0) return null;

    applicable.sort((a, b) => b.points - a.points);

    for (const step of applicable) {
      const alreadyApplied = await this.deps.getLadderCasesInWindow(
        guildId,
        targetId,
        step.points,
        expiryDays,
      );
      if (!alreadyApplied.includes(step.action)) {
        return step;
      }
    }
    return null;
  }

  async applyEscalation(
    guildId: string,
    targetId: string,
    moderatorId: string,
    warnCaseNumber: number,
    step: ModEscalationStep,
  ): Promise<{ caseNumber: number; caseId: number } | null> {
    const created = await this.deps.createCase({
      guildId,
      type: step.action,
      targetId,
      moderatorId,
      reason: `Escalation (ladder ${step.points} points) from warn #${warnCaseNumber}`,
      points: step.points,
      durationSec: step.durationSec,
      automatic: true,
      ruleKey: `ladder:${step.points}`,
      caseNumber: warnCaseNumber,
    });
    return { caseNumber: created.number, caseId: created.id };
  }

  static getDefaultLadder(strictness: ModStrictness): ModEscalationStep[] {
    switch (strictness) {
      case "RELAXED":
        return [
          { points: 5, action: "TIMEOUT", durationSec: 3600 },
          { points: 8, action: "KICK" },
        ];
      case "BALANCED":
        return [
          { points: 3, action: "TIMEOUT", durationSec: 3600 },
          { points: 5, action: "TIMEOUT", durationSec: 86400 },
          { points: 7, action: "KICK" },
          { points: 9, action: "BAN" },
        ];
      case "STRICT":
        return [
          { points: 2, action: "TIMEOUT", durationSec: 21600 },
          { points: 3, action: "KICK" },
          { points: 4, action: "BAN" },
        ];
      case "LOCKDOWN":
        return [
          { points: 2, action: "KICK" },
          { points: 3, action: "BAN" },
        ];
    }
    return [];
  }
}
