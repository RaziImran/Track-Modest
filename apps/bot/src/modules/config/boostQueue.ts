import { Queue } from "bullmq";

export const BOOST_END_JOB = "boost:end";

export interface BoostEndJobData {
  guildId: string;
  strictness: string;
  endsAt: string;
}

export function boostQueueName(guildId: string): string {
  return `modest-boost-end:${guildId}`;
}

export function boostEndJobId(guildId: string): string {
  return `boost:end:${guildId}`;
}

/** Create (or reuse) a BullMQ queue for a guild's boost:end jobs. */
export function createBoostQueue(guildId: string, redisUrl: string): Queue<BoostEndJobData> {
  return new Queue<BoostEndJobData>(boostQueueName(guildId), {
    connection: { url: redisUrl },
  });
}

/** Schedule a boost:end job to fire at endsAt. Returns the job id. */
export async function scheduleBoostEndJob(
  guildId: string,
  strictness: string,
  endsAt: Date,
  redisUrl: string,
): Promise<string> {
  const queue = createBoostQueue(guildId, redisUrl);
  const delayMs = endsAt.getTime() - Date.now();
  const job = await queue.add(
    BOOST_END_JOB,
    { guildId, strictness, endsAt: endsAt.toISOString() },
    { delay: Math.max(0, delayMs), jobId: boostEndJobId(guildId) },
  );
  await queue.close();
  return job.id ?? boostEndJobId(guildId);
}

/** Cancel any pending boost:end job for a guild. */
export async function cancelBoostEndJob(guildId: string, redisUrl: string): Promise<void> {
  const queue = createBoostQueue(guildId, redisUrl);
  await queue.remove(boostEndJobId(guildId));
  await queue.close();
}
