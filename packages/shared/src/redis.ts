import { Redis } from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}

// §7.3 Redis key conventions
export const redisKeys = {
  config: (guildId: string) => `cfg:${guildId}`,
  staff: (guildId: string, userId: string) => `staff:${guildId}:${userId}`,
  cooldown: (cmd: string, guildId: string, userId: string) => `cd:${cmd}:${guildId}:${userId}`,
  spamMsg: (guildId: string, userId: string) => `spam:msg:${guildId}:${userId}`,
  spamDup: (guildId: string, userId: string) => `spam:dup:${guildId}:${userId}`,
  raidJoins: (guildId: string) => `raid:joins:${guildId}`,
  raidBaseline: (guildId: string) => `raid:baseline:${guildId}`,
  raidState: (guildId: string) => `raid:state:${guildId}`,
  nuke: (guildId: string, executorId: string, action: string) => `nuke:${guildId}:${executorId}:${action}`,
  compromisedLink: (guildId: string, userId: string, linkHash: string) => `compromised:links:${guildId}:${userId}:${linkHash}`,
  riskScore: (guildId: string, userId: string) => `risk:score:${guildId}:${userId}`,
  raidPredictionJoins: (guildId: string) => `raid:prediction:joins:${guildId}`,
  repDaily: (guildId: string, userId: string, date: string) => `rep:daily:${guildId}:${userId}:${date}`,
  xpCd: (guildId: string, userId: string) => `xp:cd:${guildId}:${userId}`,
  aiUser: (guildId: string, userId: string, date: string) => `ai:user:${guildId}:${userId}:${date}`,
  aiGuild: (guildId: string, date: string) => `ai:guild:${guildId}:${date}`,
  aiGlobal: (date: string) => `ai:global:${date}`,
  aiRpm: () => `ai:rpm`,
  aiConvo: (guildId: string, channelId: string) => `ai:convo:${guildId}:${channelId}`,
  voiceSession: (guildId: string) => `voice:session:${guildId}`,
  panel: (messageId: string) => `panel:${messageId}`,
};

export type { Redis };
