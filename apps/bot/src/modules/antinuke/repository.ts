// §12.3 Anti-nuke repository — Redis operations for nuke rate limiting.
import { createRedis, redisKeys, type Redis } from "@modest/shared";

export interface AntiNukeRepositoryDeps {
  redisUrl: string | undefined;
}

export class AntiNukeRepository {
  private redisUrl: string | undefined;

  constructor(deps: AntiNukeRepositoryDeps) {
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

  /** Record a destructive action in the nuke rate-limit sorted set (60s window). */
  async recordNukeAction(
    guildId: string,
    executorId: string,
    actionGroup: string,
    nowMs: number,
  ): Promise<void> {
    await this.withRedis(async (redis) => {
      const key = redisKeys.nuke(guildId, executorId, actionGroup);
      await redis.zadd(key, nowMs.toString(), String(nowMs));
      await redis.expire(key, 60);
    });
  }

  /** Count destructive actions by this executor in the last 60 seconds. */
  async getNukeCount(guildId: string, executorId: string, actionGroup: string): Promise<number> {
    const result = await this.withRedis(async (redis) => {
      const key = redisKeys.nuke(guildId, executorId, actionGroup);
      const cutoff = Date.now() - 60_000;
      await redis.zremrangebyscore(key, 0, cutoff);
      return await redis.zcard(key);
    });
    return result ?? 0;
  }
}
