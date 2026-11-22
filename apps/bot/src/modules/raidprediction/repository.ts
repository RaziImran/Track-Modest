// §15.3 Raid prediction repository — Redis operations for tracking recent joins.
import { createRedis, redisKeys, type Redis } from "@modest/shared";

export interface RaidPredictionRepositoryDeps {
  redisUrl: string | undefined;
}

export class RaidPredictionRepository {
  private redisUrl: string | undefined;

  constructor(deps: RaidPredictionRepositoryDeps) {
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

  /** Record a join for raid prediction tracking. Expire after 10 minutes. */
  async recordJoin(guildId: string, userId: string, username: string, avatarHash: string | null, joinedAt: Date): Promise<void> {
    await this.withRedis(async (redis) => {
      const key = redisKeys.raidPredictionJoins(guildId);
      const score = joinedAt.getTime().toString();
      const value = JSON.stringify({ userId, username, avatarHash, joinedAt: joinedAt.toISOString() });
      await redis.zadd(key, score, value);
      await redis.expire(key, 600); // 10 minutes
    });
  }

  /** Get all joins within the last windowSec seconds. */
  async getRecentJoins(guildId: string, windowSec: number): Promise<{ userId: string; username: string; avatarHash: string | null; joinedAt: Date }[]> {
    const result = await this.withRedis(async (redis) => {
      const key = redisKeys.raidPredictionJoins(guildId);
      const now = Date.now();
      const cutoff = now - windowSec * 1000;
      await redis.zremrangebyscore(key, 0, cutoff);
      const values = await redis.zrange(key, 0, -1);
      return values.map((v) => {
        const parsed = JSON.parse(v);
        return {
          userId: parsed.userId,
          username: parsed.username,
          avatarHash: parsed.avatarHash,
          joinedAt: new Date(parsed.joinedAt),
        };
      });
    });
    return result ?? [];
  }

  /** Clear all join tracking for a guild. */
  async clearJoins(guildId: string): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis.del(redisKeys.raidPredictionJoins(guildId));
    });
  }
}
