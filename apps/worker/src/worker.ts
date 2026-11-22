import { Worker, Job } from "bullmq";
import { MODERATION_QUEUE } from "./queue.js";
import type { CaseExpireJobData, BoostEndJobData } from "./queue.js";
import { CaseExpiryService, type ExpiryDeps } from "./service.js";
import { createRedis, redisKeys } from "@modest/shared";

export async function processCaseExpire(
  job: Job<CaseExpireJobData>,
  service: CaseExpiryService,
): Promise<void> {
  const { caseId, guildId, targetId, type } = job.data;
  await service.expireCase({
    id: caseId,
    guildId,
    targetId,
    type,
    expiresAt: new Date(job.data.expiresAt),
    undone: false,
  });
}

export async function processBoostEnd(
  job: Job<BoostEndJobData>,
  deps: {
    prisma: any;
    rest: any;
    logger: any;
    redisUrl: string | undefined;
  },
): Promise<void> {
  const { guildId, strictness, endsAt } = job.data;
  const { prisma, rest, logger, redisUrl } = deps;

  // Delete the TemporaryBoost row.
  try {
    await prisma.temporaryBoost.deleteMany({
      where: {
        guildId,
        endsAt: { gt: new Date() },
      },
    });
  } catch (err) {
    logger.error(
      { service: "worker", event: "boost-end:db-delete-failed" },
      `Failed to delete TemporaryBoost for guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // §12.1 When a LOCKDOWN boost ends, restore the previous verification level.
  if (strictness === "LOCKDOWN" && redisUrl) {
    try {
      const redis = createRedis(redisUrl);
      const raw = await redis.get(redisKeys.raidState(guildId));
      await redis.disconnect();

      if (raw) {
        const state = JSON.parse(raw);
        const prevLevel = state?.prevVerifyLevel;
        if (typeof prevLevel === "number") {
          try {
            await rest.patch(
              `https://discord.com/api/v10/guilds/${guildId}`,
              { body: { verification_level: prevLevel } },
            );
            logger.info(
              { service: "worker", event: "boost-end:verify-restored", guildId },
              `Restored verification level to ${prevLevel} after raid lockdown.`,
            );
          } catch (err) {
            logger.error(
              { service: "worker", event: "boost-end:verify-restore-failed", guildId },
              `Failed to restore verification level for guild ${guildId}`,
              err instanceof Error ? err : new Error(String(err)),
            );
          }
        }

        // Clear raid state once the boost ends (whether or not restoration succeeded).
        try {
          const redis = createRedis(redisUrl);
          await redis.del(redisKeys.raidState(guildId));
          await redis.disconnect();
        } catch {
          // Best-effort cleanup.
        }
      }
    } catch (err) {
      logger.error(
        { service: "worker", event: "boost-end:raid-state-failed", guildId },
        `Failed to read raid state for guild ${guildId}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // Look up the mod-log channel and post "Protection returned to Balanced."
  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { modLogChannelId: true },
    });
    const modLogChannelId = config?.modLogChannelId;
    if (!modLogChannelId) {
      logger.info(
        { service: "worker", event: "boost-end:no-modlog" },
        `No mod-log channel for guild ${guildId}; skipping boost-end notification`,
      );
      return;
    }

    await rest.post(
      `https://discord.com/api/v10/channels/${modLogChannelId}/messages`,
      {
        body: {
          embeds: [
            {
              title: "Temporary strictness boost expired",
              description: `Protection returned to **Balanced**. (Boost was **{strictness}**, ended {endsAt})`.replace("{strictness}", strictness).replace("{endsAt}", `<t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>`),
              color: 0x5865F2,
            },
          ],
        },
      },
    );
  } catch (err) {
    logger.error(
      { service: "worker", event: "boost-end:notify-failed" },
      `Failed to post boost-end notification for guild ${guildId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

export function createCaseExpireWorker(
  redisUrl: string,
  deps: ExpiryDeps,
): Worker<CaseExpireJobData> {
  const service = new CaseExpiryService(deps);
  return new Worker<CaseExpireJobData>(
    MODERATION_QUEUE,
    async (job: Job<CaseExpireJobData>) => {
      await processCaseExpire(job, service);
    },
    { connection: { url: redisUrl } },
  );
}

export function createBoostEndWorker(
  redisUrl: string,
  deps: {
    prisma: any;
    rest: any;
    logger: any;
    redisUrl: string | undefined;
  },
): Worker<BoostEndJobData> {
  return new Worker<BoostEndJobData>(
    MODERATION_QUEUE,
    async (job: Job<BoostEndJobData>) => {
      await processBoostEnd(job, deps);
    },
    { connection: { url: redisUrl } },
  );
}
