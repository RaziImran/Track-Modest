// §15.1 Risk score — event integration and cached lookup.
// Exported handlers are called from other modules (guildMemberAdd, automod, cases, reports).
import { client } from "../../client.js";
import { Events, GuildMember } from "discord.js";
import { prisma } from "@modest/db";
import { RiskRepository } from "./repository.js";
import { computeRiskScore, parseConfig } from "./service.js";

const RISK_CACHE_TTL_SEC = 10 * 60; // 10 minutes

export interface RiskServiceDeps {
  getActiveWarnPoints: (guildId: string, userId: string) => Promise<number>;
  getOpenReportsCount: (guildId: string, userId: string) => Promise<number>;
  getMemberRep: (guildId: string, userId: string) => Promise<number>;
  getMemberJoinedAt: (guildId: string, userId: string) => Promise<Date | null>;
  isJoinedDuringRaid: (guildId: string, userId: string) => Promise<boolean>;
  getAutomodHitsLast7Days: (guildId: string, userId: string) => Promise<number>;
  isInSharedBanNetwork: (guildId: string, userId: string) => Promise<boolean>;
}

let deps: RiskServiceDeps | null = null;
let redisUrl: string | undefined;

export function setRiskDeps(d: RiskServiceDeps, url: string | undefined) {
  deps = d;
  redisUrl = url;
}

/** Compute and cache the risk score for a member. Call on join, automod hit, case, report. */
export async function computeAndCacheRisk(member: GuildMember): Promise<void> {
  if (!deps) return;
  const guildId = member.guild.id;
  const overrides = (await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true },
  }))?.overrides as Record<string, unknown> | undefined;
  const config = parseConfig(overrides);

  const result = await computeRiskScore(member, guildId, deps, config);

  const repo = new RiskRepository({ redisUrl });
  await repo.setRiskScore(
    guildId,
    member.id,
    result.score,
    result.label,
    result.factors.map((f) => f.label),
    RISK_CACHE_TTL_SEC,
  );
}

/** Get cached risk score for a member (staff-only lookup). */
export async function getCachedRiskScore(guildId: string, userId: string) {
  if (!redisUrl) return null;
  const repo = new RiskRepository({ redisUrl });
  return await repo.getRiskScore(guildId, userId);
}

/** Clear cached risk score for a member. */
export async function clearCachedRiskScore(guildId: string, userId: string) {
  if (!redisUrl) return;
  const repo = new RiskRepository({ redisUrl });
  await repo.clearRiskScore(guildId, userId);
}

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;
  await computeAndCacheRisk(member);
});
