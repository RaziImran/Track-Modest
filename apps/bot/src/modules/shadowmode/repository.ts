// §15.4 Shadow mode repository — Prisma operations for shadow rules.
import { prisma } from "@modest/db";
import type { ShadowModeServiceDeps } from "./service.js";

export interface ShadowModeRepositoryDeps {}

export class ShadowModeRepository {
  constructor(_deps: ShadowModeRepositoryDeps) {}

  async getShadowRules(guildId: string) {
    const rows = await prisma.automodRule.findMany({
      where: { guildId, shadow: true },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      ruleId: row.id,
      guildId: row.guildId,
      ruleName: row.name,
      shadowStartedAt: row.shadowStartedAt ?? new Date(),
      shadowUntil: row.shadowUntil ?? new Date(),
      hitCount: row.shadowHitCount,
      falsePositiveCount: row.shadowFalsePositive,
    }));
  }

  async recordShadowHit(input: {
    guildId: string;
    ruleId: number;
    ruleName: string;
    isFalsePositive: boolean;
  }) {
    await prisma.automodRule.update({
      where: { id: input.ruleId },
      data: {
        shadowHitCount: {
          increment: 1,
        },
        shadowFalsePositive: input.isFalsePositive
          ? { increment: 1 }
          : undefined,
      },
    });
  }

  async setShadowDuration(_guildId: string, ruleId: number, days: number) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    await prisma.automodRule.update({
      where: { id: ruleId },
      data: {
        shadow: true,
        shadowStartedAt: now,
        shadowUntil: until,
      },
    });
  }

  async disableShadow(_guildId: string, ruleId: number) {
    await prisma.automodRule.update({
      where: { id: ruleId },
      data: {
        shadow: false,
        shadowStartedAt: null,
        shadowUntil: null,
      },
    });
  }

  /** Create the service deps from this repository. */
  static createServiceDeps(repo: ShadowModeRepository): ShadowModeServiceDeps {
    return {
      getShadowRules: (guildId) => repo.getShadowRules(guildId),
      recordShadowHit: (input) => repo.recordShadowHit(input),
      setShadowDuration: (guildId, ruleId, days) => repo.setShadowDuration(guildId, ruleId, days),
      disableShadow: (guildId, ruleId) => repo.disableShadow(guildId, ruleId),
    };
  }
}
