import { Worker, Job } from "bullmq";
import { MODERATION_QUEUE } from "./queue.js";
import type { CaseExpireJobData } from "./queue.js";
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
