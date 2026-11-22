// §15.4 Shadow mode — pure service layer (no discord.js imports).
export type ShadowStatus = "active" | "expired" | "disabled";

export interface ShadowRuleConfig {
  ruleId: number;
  guildId: string;
  ruleName: string;
  shadowStartedAt: Date; // when shadow mode was enabled
  shadowUntil: Date; // when shadow mode expires
  hitCount: number;
  falsePositiveCount: number;
}

export interface ShadowSummary {
  ruleId: number;
  ruleName: string;
  hitCount: number;
  falsePositiveCount: number;
  wouldHaveActed: number; // hitCount - falsePositiveCount
  daysActive: number;
  expired: boolean;
}

export interface ShadowModeServiceDeps {
  getShadowRules: (guildId: string) => Promise<ShadowRuleConfig[]>;
  recordShadowHit: (input: {
    guildId: string;
    ruleId: number;
    ruleName: string;
    isFalsePositive: boolean;
  }) => Promise<void>;
  setShadowDuration: (guildId: string, ruleId: number, days: number) => Promise<void>;
  disableShadow: (guildId: string, ruleId: number) => Promise<void>;
}

export class ShadowModeService {
  public deps: ShadowModeServiceDeps;

  constructor(deps: ShadowModeServiceDeps) {
    this.deps = deps;
  }

  async getShadowRules(guildId: string): Promise<ShadowRuleConfig[]> {
    return this.deps.getShadowRules(guildId);
  }

  async recordShadowHit(input: {
    guildId: string;
    ruleId: number;
    ruleName: string;
    isFalsePositive: boolean;
  }): Promise<void> {
    await this.deps.recordShadowHit(input);
  }

  async enableShadow(guildId: string, ruleId: number, days: number = 7): Promise<void> {
    await this.deps.setShadowDuration(guildId, ruleId, days);
  }

  async disableShadow(guildId: string, ruleId: number): Promise<void> {
    await this.deps.disableShadow(guildId, ruleId);
  }

  computeSummary(rule: ShadowRuleConfig, now: Date = new Date()): ShadowSummary {
    const daysActive = Math.max(0, Math.ceil((now.getTime() - rule.shadowStartedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const expired = now.getTime() > rule.shadowUntil.getTime();
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      hitCount: rule.hitCount,
      falsePositiveCount: rule.falsePositiveCount,
      wouldHaveActed: rule.hitCount - rule.falsePositiveCount,
      daysActive,
      expired,
    };
  }

  isExpired(rule: ShadowRuleConfig, now: Date = new Date()): boolean {
    return now.getTime() > rule.shadowUntil.getTime();
  }
}
