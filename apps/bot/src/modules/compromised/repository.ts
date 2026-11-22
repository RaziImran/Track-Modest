// §20.6 Compromised account repository — Redis operations for link tracking.
import { createRedis, redisKeys, type Redis } from "@modest/shared";

export interface CompromisedRepositoryDeps {
  redisUrl: string | undefined;
}

export class CompromisedRepository {
  private redisUrl: string | undefined;

  constructor(deps: CompromisedRepositoryDeps) {
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

  /** Record that a link was posted in a channel by a user. Returns the set of channel IDs. */
  async recordLink(
    guildId: string,
    userId: string,
    linkHash: string,
    channelId: string,
    ttlSec: number,
  ): Promise<string[]> {
    const result = await this.withRedis(async (redis) => {
      const key = redisKeys.compromisedLink(guildId, userId, linkHash);
      await redis.sadd(key, channelId);
      await redis.expire(key, ttlSec);
      return await redis.smembers(key);
    });
    return result ?? [];
  }

  /** Get the set of channel IDs where a link was posted. */
  async getLinkChannels(
    guildId: string,
    userId: string,
    linkHash: string,
  ): Promise<string[]> {
    const result = await this.withRedis(async (redis) => {
      const key = redisKeys.compromisedLink(guildId, userId, linkHash);
      return await redis.smembers(key);
    });
    return result ?? [];
  }

  /** Clear link tracking for a user. */
  async clearUserLinks(guildId: string, userId: string): Promise<void> {
    await this.withRedis(async (redis) => {
      // Scan for keys matching the pattern and delete them
      const pattern = `compromised:links:${guildId}:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    });
  }
}
