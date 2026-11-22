import { Queue } from "bullmq";

export const MODERATION_QUEUE = "moderation";
export const CASE_EXPIRE_JOB = "case-expire";
export const BOOST_END_JOB = "boost:end";

export type CaseExpireType = "TEMPBAN" | "TIMEOUT";

export interface CaseExpireJobData {
  caseId: number;
  guildId: string;
  targetId: string;
  type: CaseExpireType;
  expiresAt: string;
}

export interface BoostEndJobData {
  guildId: string;
  strictness: string;
  endsAt: string;
}

export function buildJobId(caseId: number): string {
  return `case-expire:${caseId}`;
}

export function boostEndJobId(guildId: string): string {
  return `boost:end:${guildId}`;
}

export function buildJobPayload(
  caseId: number,
  guildId: string,
  targetId: string,
  type: CaseExpireType,
  expiresAt: Date,
): CaseExpireJobData {
  return {
    caseId,
    guildId,
    targetId,
    type,
    expiresAt: expiresAt.toISOString(),
  };
}

export function createModerationQueue(redisUrl: string): Queue<CaseExpireJobData> {
  return new Queue<CaseExpireJobData>(MODERATION_QUEUE, {
    connection: { url: redisUrl },
  });
}

export function createBoostEndQueue(redisUrl: string): Queue<BoostEndJobData> {
  return new Queue<BoostEndJobData>(MODERATION_QUEUE, {
    connection: { url: redisUrl },
  });
}
