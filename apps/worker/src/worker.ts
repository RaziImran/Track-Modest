import { Worker, Job } from "bullmq";
import { MODERATION_QUEUE } from "./queue.js";
import type { CaseExpireJobData, BoostEndJobData } from "./queue.js";
import { CaseExpiryService, type ExpiryDeps } from "./service.js";

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
  },
): Promise<void> {
  const { guildId, strictness, endsAt } = job.data;
  const { prisma, rest, logger } = deps;

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
