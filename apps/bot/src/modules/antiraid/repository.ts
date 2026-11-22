// §12.1 Anti-raid repository — Redis operations for join tracking and baseline.
import { createRedis, redisKeys, type Redis } from "@modest/shared";
import type { RaidState } from "./service.js";

export interface AntiraidRepositoryDeps {
  redisUrl: string | undefined;
}

export class AntiraidRepository {
  private redisUrl: string | undefined;

  constructor(deps: AntiraidRepositoryDeps) {
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

  /** Record a join in the sorted set with the current timestamp as score. Expire after windowSec. */
  async recordJoin(guildId: string, memberId: string, nowMs: number, windowSec: number): Promise<void> {
    await this.withRedis(async (redis) => {
      const key = redisKeys.raidJoins(guildId);
      await redis.zadd(key, nowMs.toString(), memberId);
      await redis.expire(key, windowSec);
    });
  }

  /** Remove entries older than windowSec and return the count of remaining joins. */
  async getJoinWindow(guildId: string, windowSec: number): Promise<number> {
    const result = await this.withRedis(async (redis) => {
      const key = redisKeys.raidJoins(guildId);
      const cutoff = Date.now() - windowSec * 1000;
      await redis.zremrangebyscore(key, 0, cutoff);
      return await redis.zcard(key);
    });
    return result ?? 0;
  }

  /** Get the rolling baseline (joins per windowSec) for the guild. */
  async getBaseline(guildId: string): Promise<number> {
    const result = await this.withRedis(async (redis) => {
      const raw = await redis.get(redisKeys.raidBaseline(guildId));
      return raw ? Number.parseInt(raw, 10) : 1;
    });
    return result ?? 1;
  }

  /** Set the rolling baseline for the guild (called by worker hourly). */
  async setBaseline(guildId: string, baseline: number): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis.set(redisKeys.raidBaseline(guildId), baseline.toString());
    });
  }

  /** Store raid state as JSON with TTL (used by alert buttons and boost-end restoration). */
  async setRaidState(
    guildId: string,
    state: RaidState,
    ttlSec: number,
  ): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis.set(redisKeys.raidState(guildId), JSON.stringify(state), "EX", ttlSec);
    });
  }

  /** Retrieve raid state for a guild. */
  async getRaidState(guildId: string): Promise<RaidState | null> {
    const result = await this.withRedis(async (redis) => {
      const raw = await redis.get(redisKeys.raidState(guildId));
      return raw ? (JSON.parse(raw) as RaidState) : null;
    });
    return result ?? null;
  }

  /** Clear raid state for a guild. */
  async clearRaidState(guildId: string): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis.del(redisKeys.raidState(guildId));
    });
  }
}
