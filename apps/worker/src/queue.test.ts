import { describe, it, expect } from "vitest";
import {
  buildJobId,
  buildJobPayload,
  CASE_EXPIRE_JOB,
  MODERATION_QUEUE,
} from "./queue.js";

describe("queue", () => {
  it("builds the job id as case-expire:<caseId>", () => {
    expect(buildJobId(42)).toBe("case-expire:42");
    expect(buildJobId(7)).toBe("case-expire:7");
  });

  it("builds the job payload with an ISO expiresAt string", () => {
    const expiresAt = new Date("2026-01-01T00:00:00Z");
    const payload = buildJobPayload(42, "g1", "u1", "TIMEOUT", expiresAt);

    expect(payload).toEqual({
      caseId: 42,
      guildId: "g1",
      targetId: "u1",
      type: "TIMEOUT",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("defines the moderation queue and case-expire job names", () => {
    expect(MODERATION_QUEUE).toBe("moderation");
    expect(CASE_EXPIRE_JOB).toBe("case-expire");
  });
});
