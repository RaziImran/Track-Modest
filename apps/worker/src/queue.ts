import { Queue } from "bullmq";

export const MODERATION_QUEUE = "moderation";
export const CASE_EXPIRE_JOB = "case-expire";

export type CaseExpireType = "TEMPBAN" | "TIMEOUT";

export interface CaseExpireJobData {
  caseId: number;
  guildId: string;
  targetId: string;
  type: CaseExpireType;
  expiresAt: string;
}

export function buildJobId(caseId: number): string {
  return `case-expire:${caseId}`;
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
