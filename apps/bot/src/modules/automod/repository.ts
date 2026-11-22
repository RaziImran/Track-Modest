// §11 AutoMod repository — Prisma + Redis operations for the automod pipeline.
import { prisma } from "@modest/db";
import type { AutomodServiceDeps } from "./service.js";
import { createRedis, redisKeys, type Redis } from "@modest/shared";
import type { AutomodRuleTrigger, AutomodRuleAction } from "./schemas.js";

export interface AutomodRepositoryDeps {
  redisUrl: string;
}

export interface AutomodRuleRow {
  id: number;
  guildId: string;
  name: string;
  enabled: boolean;
  shadow: boolean;
  trigger: AutomodRuleTrigger;
  actions: AutomodRuleAction[];
  exemptRoles: string[];
  exemptChannels: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomodHitRow {
  id: string; // BigInt as string
  guildId: string;
  userId: string;
  channelId: string;
  ruleKey: string;
  action: string;
  shadow: boolean;
  createdAt: Date;
}

export class AutomodRepository {
  private redis: Redis;

  constructor(deps: AutomodRepositoryDeps) {
    this.redis = createRedis(deps.redisUrl);
  }

  // ───────────────────────────── Prisma: rules ─────────────────────────────

  async getAutomodRules(guildId: string): Promise<AutomodRuleRow[]> {
    const rows = await prisma.automodRule.findMany({
      where: { guildId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapRuleRow);
  }

  async getAutomodRule(ruleId: number): Promise<AutomodRuleRow | null> {
    const row = await prisma.automodRule.findUnique({ where: { id: ruleId } });
    return row ? mapRuleRow(row) : null;
  }

  async createAutomodRule(input: {
    guildId: string;
    name: string;
    enabled: boolean;
    shadow: boolean;
    trigger: AutomodRuleTrigger;
    actions: AutomodRuleAction[];
    exemptRoles: string[];
    exemptChannels: string[];
    createdBy: string;
  }): Promise<AutomodRuleRow> {
    const row = await prisma.automodRule.create({
      data: {
        guildId: input.guildId,
        name: input.name,
        enabled: input.enabled,
        shadow: input.shadow,
        trigger: input.trigger as any,
        actions: input.actions as any,
        exemptRoles: input.exemptRoles,
        exemptChannels: input.exemptChannels,
        createdBy: input.createdBy,
      },
    });
    return mapRuleRow(row);
  }

  async updateAutomodRule(ruleId: number, input: Partial<Omit<CreateAutomodRuleInput, "guildId" | "createdBy">>): Promise<AutomodRuleRow> {
    const row = await prisma.automodRule.update({
      where: { id: ruleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.shadow !== undefined ? { shadow: input.shadow } : {}),
        ...(input.trigger !== undefined ? { trigger: input.trigger as any } : {}),
        ...(input.actions !== undefined ? { actions: input.actions as any } : {}),
        ...(input.exemptRoles !== undefined ? { exemptRoles: input.exemptRoles } : {}),
        ...(input.exemptChannels !== undefined ? { exemptChannels: input.exemptChannels } : {}),
      } as any,
    });
    return mapRuleRow(row);
  }

  async deleteAutomodRule(ruleId: number): Promise<void> {
    await prisma.automodRule.delete({ where: { id: ruleId } });
  }

  // ───────────────────────────── Prisma: hits ─────────────────────────────

  async recordAutomodHit(input: {
    guildId: string;
    userId: string;
    channelId: string;
    ruleKey: string;
    action: string;
    shadow: boolean;
  }): Promise<AutomodHitRow> {
    const row = await prisma.automodHit.create({
      data: {
        guildId: input.guildId,
        userId: input.userId,
        channelId: input.channelId,
        ruleKey: input.ruleKey,
        action: input.action,
        shadow: input.shadow,
      },
    });
    return mapHitRow(row);
  }

  async getRepeatHitCount(guildId: string, userId: string, windowSec: number): Promise<number> {
    const cutoff = new Date(Date.now() - windowSec * 1000);
    const count = await prisma.automodHit.count({
      where: {
        guildId,
        userId,
        createdAt: { gte: cutoff },
      },
    });
    return count;
  }

  // ───────────────────────────── Redis: rate limiting ─────────────────────────────

  async checkRateLimit(guildId: string, userId: string, maxMessages: number, windowSec: number): Promise<{ allowed: boolean; remaining: number }> {
    const key = redisKeys.automodRate(guildId, userId);
    const nowMs = Date.now();
    const cutoff = nowMs - windowSec * 1000;

    await this.redis.multi()
      .zadd(key, nowMs.toString(), `${nowMs}-${Math.random()}`)
      .zremrangebyscore(key, 0, cutoff)
      .zcard(key)
      .expire(key, windowSec)
      .exec();

    // The zcard result is the 3rd element (index 2) of the multi response.
    // ioredis multi returns [[err, result1], [err, result2], ...]
    const cardResult = (await this.redis.zcard(key)) as number;
    const allowed = cardResult <= maxMessages;
    return { allowed, remaining: Math.max(0, maxMessages - cardResult) };
  }

  // ───────────────────────────── Redis: duplicate detection ─────────────────────────────

  /** Record a message hash for duplicate detection; returns true if it's a duplicate within the window. */
  async recordMessageHash(
    guildId: string,
    userId: string,
    messageHash: string,
    windowSec: number,
    maxRepeats: number,
  ): Promise<{ isDuplicate: boolean; count: number }> {
    const key = redisKeys.automodDup(guildId, userId);
    const nowMs = Date.now();

    // Add this hash with its timestamp as score
    await this.redis.zadd(key, nowMs.toString(), `${messageHash}-${nowMs}`);
    await this.redis.zremrangebyscore(key, 0, nowMs - windowSec * 1000);
    await this.redis.expire(key, windowSec);

    // zcount counts all members; we need to count occurrences of this hash.
    // Since each member is unique (hash-timestamp), count distinct hash prefixes.
    const members = await this.redis.zrange(key, 0, -1);
    const hashCount = members.filter((m) => m.startsWith(`${messageHash}-`)).length;

    return { isDuplicate: hashCount > maxRepeats, count: hashCount };
  }

  /** Cross-channel duplicate: track that this hash appeared in a channel. Returns number of distinct channels seen recently. */
  async recordCrossChannelHash(guildId: string, messageHash: string, channelId: string, windowSec: number): Promise<number> {
    const key = redisKeys.automodDupChannel(guildId, messageHash);
    await this.redis.sadd(key, channelId);
    await this.redis.expire(key, windowSec);
    return await this.redis.scard(key);
  }

  // ───────────────────────────── Redis: repeat escalation ─────────────────────────────

  async incrementRepeatHits(guildId: string, userId: string, windowSec: number): Promise<number> {
    const key = redisKeys.automodEscalation(guildId, userId);
    await this.redis.incr(key);
    await this.redis.expire(key, windowSec);
    return (await this.redis.get(key)) === null ? 1 : Number(await this.redis.get(key));
  }

  async getRepeatHits(guildId: string, userId: string): Promise<number> {
    const raw = await this.redis.get(redisKeys.automodEscalation(guildId, userId));
    return raw === null ? 0 : Number(raw);
  }

  // ───────────────────────────── Redis: phishing domains ─────────────────────────────

  async isPhishDomain(domain: string): Promise<boolean> {
    const result = await this.redis.sismember(redisKeys.phishDomains(), domain);
    return result === 1;
  }

  async replacePhishDomains(domains: string[]): Promise<void> {
    const tempKey = `phish:domains:temp:${Date.now()}`;
    if (domains.length > 0) {
      await this.redis.sadd(tempKey, ...domains);
    }
    await this.redis.expire(tempKey, 3600);
    // Atomic rename replaces the old set
    await this.redis.rename(tempKey, redisKeys.phishDomains());
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  /** Create the service deps from this repository. */
  static createServiceDeps(repo: AutomodRepository): AutomodServiceDeps {
    return {
      getAutomodRules: (guildId: string) => repo.getAutomodRules(guildId),
      recordAutomodHit: (input: { guildId: string; userId: string; channelId: string; ruleKey: string; action: string; shadow: boolean }) => repo.recordAutomodHit(input),
      getRepeatHitCount: (guildId: string, userId: string, windowSec: number) => repo.getRepeatHitCount(guildId, userId, windowSec),
      checkRateLimit: (guildId: string, userId: string, maxMessages: number, windowSec: number) => repo.checkRateLimit(guildId, userId, maxMessages, windowSec),
      recordMessageHash: (guildId: string, userId: string, messageHash: string, windowSec: number, maxRepeats: number) =>
        repo.recordMessageHash(guildId, userId, messageHash, windowSec, maxRepeats),
      recordCrossChannelHash: (guildId: string, messageHash: string, channelId: string, windowSec: number) =>
        repo.recordCrossChannelHash(guildId, messageHash, channelId, windowSec),
      incrementRepeatHits: (guildId: string, userId: string, windowSec: number) => repo.incrementRepeatHits(guildId, userId, windowSec),
      getRepeatHits: (guildId: string, userId: string) => repo.getRepeatHits(guildId, userId),
      isPhishDomain: (domain: string) => repo.isPhishDomain(domain),
    };
  }
}

function mapRuleRow(row: any): AutomodRuleRow {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    enabled: row.enabled,
    shadow: row.shadow,
    trigger: row.trigger as AutomodRuleTrigger,
    actions: row.actions as AutomodRuleAction[],
    exemptRoles: row.exemptRoles as string[],
    exemptChannels: row.exemptChannels as string[],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapHitRow(row: any): AutomodHitRow {
  return {
    id: String(row.id),
    guildId: row.guildId,
    userId: row.userId,
    channelId: row.channelId,
    ruleKey: row.ruleKey,
    action: row.action,
    shadow: row.shadow,
    createdAt: row.createdAt,
  };
}

// Import type used in updateAutomodRule partial
import type { CreateAutomodRuleInput } from "./schemas.js";
