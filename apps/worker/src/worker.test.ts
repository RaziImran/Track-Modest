import { describe, it, expect, vi } from "vitest";
import { processCaseExpire } from "./worker.js";
import { CaseExpiryService, type ExpiredCase, type ExpiryDeps } from "./service.js";
import type { Job } from "bullmq";
import type { CaseExpireJobData } from "./queue.js";

type ExpiryParams = {
  type: "TEMPBAN" | "TIMEOUT";
  guildId: string;
  targetId: string;
  reason: string;
};

const job = (data: Partial<CaseExpireJobData>): Job<CaseExpireJobData> =>
  ({
    data: {
      caseId: 3,
      guildId: "g1",
      targetId: "u1",
      type: "TEMPBAN",
      expiresAt: "2025-01-01T00:00:00.000Z",
      ...data,
    },
  } as unknown as Job<CaseExpireJobData>);

describe("worker", () => {
  it("expires the case from the job payload", async () => {
    const findCaseById = vi.fn<(caseId: number) => Promise<ExpiredCase | null>>().mockResolvedValue({
      id: 3,
      guildId: "g1",
      targetId: "u1",
      type: "TEMPBAN",
      expiresAt: new Date("2025-01-01T00:00:00Z"),
      undone: false,
    });
    const performExpiry = vi.fn<(params: ExpiryParams) => Promise<void>>().mockResolvedValue(undefined);
    const markCaseUndone = vi.fn<(caseId: number) => Promise<void>>().mockResolvedValue(undefined);
    const deps: ExpiryDeps = {
      findExpiredCases: vi.fn(),
      findCaseById,
      markCaseUndone,
      performExpiry,
      logger: { error: vi.fn(), info: vi.fn() },
    };
    const service = new CaseExpiryService(deps);

    await processCaseExpire(job({}), service);

    expect(performExpiry).toHaveBeenCalledTimes(1);
    expect(performExpiry).toHaveBeenCalledWith({
      type: "TEMPBAN",
      guildId: "g1",
      targetId: "u1",
      reason: "Temporary moderation action expired",
    });
    expect(markCaseUndone).toHaveBeenCalledWith(3);
  });
});
