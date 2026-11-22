// §15.1 Risk score repository — Redis caching of computed risk scores (10 min TTL).
import { createRedis, redisKeys, type Redis } from "@modest/shared";

export interface RiskRepositoryDeps {
  redisUrl: string | undefined;
}

export class RiskRepository {
  private redisUrl: string | undefined;

  constructor(deps: RiskRepositoryDeps) {
    this.redisUrl = deps.redisUrl;
  }

  private async withRedis<T>(fn: (redis: Redis) => Promise<T>): Promise<T | null> {
    if (!this.redisUrl) return null;
    const redis = createRedis(this.redisUrl);
    try {
      return await fn(redis);
    } catch {
      return null;
    } finally {
      await redis.disconnect();
    }
  }

  /** Get cached risk score for a member. Returns null if not cached or expired. */
  async getRiskScore(guildId: string, userId: string): Promise<{ score: number; label: string; factors: string[] } | null> {
    const result = await this.withRedis(async (redis) => {
      const raw = await redis.get(redisKeys.riskScore(guildId, userId));
      return raw ? JSON.parse(raw) : null;
    });
    return result ?? null;
  }

  /** Cache risk score for a member with 10-minute TTL. */
  async setRiskScore(
    guildId: string,
    userId: string,
    score: number,
    label: string,
    factors: string[],
    ttlSec: number,
  ): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis.set(redisKeys.riskScore(guildId, userId), JSON.stringify({ score, label, factors }), "EX", ttlSec);
    });
  }

  /** Clear cached risk score for a member. */
  async clearRiskScore(guildId: string, userId: string): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis.del(redisKeys.riskScore(guildId, userId));
    });
  }
}
