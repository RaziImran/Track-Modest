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
  findCase: (guildId: string, caseNumber: number) => Promise<{
    id: number;
    number: number;
    type: string;
    targetId: string;
    moderatorId: string;
    reason: string;
    durationSec: number | null;
    points: number;
    undone: boolean;
    undoneBy: string | null;
    undoneAt: Date | null;
    logMessageId: string | null;
    createdAt: Date;
  } | null>;
  undoCase: (guildId: string, caseNumber: number, undoneBy: string) => Promise<void>;
}

export interface MassBanResult {
  caseNumbers: number[];
  caseIds: number[];
  bannedUserIds: string[];
  failedUserIds: string[];
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

  async applyTimeout(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
    durationSec: number,
  ): Promise<{ caseNumber: number; caseId: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: "TIMEOUT",
      targetId,
      moderatorId,
      reason,
      durationSec,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await this.deps.applyRepPenalty(guildId, targetId, -50);
    return { caseNumber, caseId: created.id };
  }

  async applyKick(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
  ): Promise<{ caseNumber: number; caseId: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: "KICK",
      targetId,
      moderatorId,
      reason,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await this.deps.applyRepPenalty(guildId, targetId, -50);
    return { caseNumber, caseId: created.id };
  }

  async applyBan(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
    durationSec?: number,
  ): Promise<{ caseNumber: number; caseId: number; type: "BAN" | "TEMPBAN"; durationSec?: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: durationSec ? "TEMPBAN" : "BAN",
      targetId,
      moderatorId,
      reason,
      durationSec,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await this.deps.applyRepPenalty(guildId, targetId, -100);
    return { caseNumber, caseId: created.id, type: durationSec ? "TEMPBAN" : "BAN", durationSec };
  }

  async applySoftBan(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
  ): Promise<{ caseNumber: number; caseId: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: "SOFTBAN",
      targetId,
      moderatorId,
      reason,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await this.deps.applyRepPenalty(guildId, targetId, -100);
    return { caseNumber, caseId: created.id };
  }

  async applyUnBan(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
  ): Promise<{ caseNumber: number; caseId: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: "UNBAN",
      targetId,
      moderatorId,
      reason,
      points: 0,
      caseNumber,
      automatic: false,
    });
    return { caseNumber, caseId: created.id };
  }

  async applyUnTimeout(
    guildId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
  ): Promise<{ caseNumber: number; caseId: number }> {
    const caseNumber = await this.deps.incrementCaseCounter(guildId);
    const created = await this.deps.createCase({
      guildId,
      type: "UNTIMEOUT",
      targetId,
      moderatorId,
      reason,
      points: 0,
      caseNumber,
      automatic: false,
    });
    return { caseNumber, caseId: created.id };
  }

  async applyMassBan(
    guildId: string,
    targetIds: string[],
    moderatorId: string,
    reason: string,
  ): Promise<MassBanResult> {
    const caseNumbers: number[] = [];
    const caseIds: number[] = [];
    const bannedUserIds: string[] = [];
    const failedUserIds: string[] = [];

    for (const targetId of targetIds) {
      try {
        const caseNumber = await this.deps.incrementCaseCounter(guildId);
        const created = await this.deps.createCase({
          guildId,
          type: "BAN",
          targetId,
          moderatorId,
          reason,
          points: 0,
          caseNumber,
          automatic: false,
        });
        await this.deps.applyRepPenalty(guildId, targetId, -100);
        caseNumbers.push(caseNumber);
        caseIds.push(created.id);
        bannedUserIds.push(targetId);
      } catch {
        failedUserIds.push(targetId);
      }
    }

    return { caseNumbers, caseIds, bannedUserIds, failedUserIds };
  }

  /**
   * Parse a human duration string into seconds. Supports combined units, e.g.
   * "90m" -> 5400, "2h30m" -> 9000, "1d" -> 86400, "28d" -> 2419200, "1w" -> 604800.
   * Units: s (seconds), m (minutes), h (hours), d (days), w (weeks).
   * Throws on empty or unparseable input.
   */
  static parseDuration(input: string): number {
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
    const clean = input.trim().toLowerCase().replace(/\s+/g, "");
    if (clean.length === 0) {
      throw new Error(`Invalid duration: "${input}"`);
    }
    const tokenRe = /(\d+)(s|m|h|d|w)/g;
    let total = 0;
    let consumed = "";
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(clean)) !== null) {
      const value = Number.parseInt(match[1] ?? "0", 10);
      const unit = match[2] ?? "";
      total += value * (units[unit] ?? 0);
      consumed += match[0];
    }
    if (consumed.length === 0 || consumed !== clean) {
      throw new Error(`Invalid duration: "${input}"`);
    }
    return total;
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

  async undoCase(
    guildId: string,
    caseNumber: number,
    undoneBy: string,
  ): Promise<{
    type: ModCaseType;
    targetId: string;
    points: number;
    durationSec?: number;
  } | null> {
    const case_ = await this.deps.findCase(guildId, caseNumber);
    if (!case_ || case_.undone) return null;

    await this.deps.undoCase(guildId, caseNumber, undoneBy);

    // Restore rep penalty based on the original action type (§10.4)
    if (case_.type === "WARN") {
      await this.deps.applyRepPenalty(guildId, case_.targetId, 20 * case_.points);
    } else if (case_.type === "TIMEOUT" || case_.type === "KICK") {
      await this.deps.applyRepPenalty(guildId, case_.targetId, 50);
    } else if (case_.type === "BAN" || case_.type === "TEMPBAN" || case_.type === "SOFTBAN") {
      await this.deps.applyRepPenalty(guildId, case_.targetId, 100);
    }

    return {
      type: case_.type as ModCaseType,
      targetId: case_.targetId,
      points: case_.points,
      ...(case_.durationSec ? { durationSec: case_.durationSec } : {}),
    };
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
