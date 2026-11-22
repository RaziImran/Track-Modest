// §12.2 Verification repository — Prisma operations for VerificationState.
import { prisma } from "@modest/db";
import type { VerificationServiceDeps } from "./service.js";

export interface VerificationRepositoryDeps {}

export class VerificationRepository {
  constructor(_deps: VerificationRepositoryDeps) {}

  async getVerificationState(guildId: string, userId: string) {
    const row = await prisma.verificationState.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!row) return null;
    return {
      guildId: row.guildId,
      userId: row.userId,
      method: row.method as "button" | "captcha" | "quiz",
      attempts: row.attempts,
      captchaAnswer: row.captchaAnswer,
      passedAt: row.passedAt,
      createdAt: row.createdAt,
    };
  }

  async setVerificationState(input: {
    guildId: string;
    userId: string;
    method: "button" | "captcha" | "quiz";
    attempts: number;
    captchaAnswer: string | null;
    passedAt: Date | null;
  }) {
    await prisma.verificationState.upsert({
      where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
      update: {
        method: input.method,
        attempts: input.attempts,
        captchaAnswer: input.captchaAnswer,
        passedAt: input.passedAt,
      },
      create: {
        guildId: input.guildId,
        userId: input.userId,
        method: input.method,
        attempts: input.attempts,
        captchaAnswer: input.captchaAnswer,
        passedAt: input.passedAt,
      },
    });
  }

  async clearVerificationState(guildId: string, userId: string) {
    await prisma.verificationState.deleteMany({
      where: { guildId, userId },
    });
  }

  /** Create the service deps from this repository. */
  static createServiceDeps(repo: VerificationRepository): VerificationServiceDeps {
    return {
      getVerificationState: (guildId, userId) => repo.getVerificationState(guildId, userId),
      setVerificationState: (input) => repo.setVerificationState(input),
      clearVerificationState: (guildId, userId) => repo.clearVerificationState(guildId, userId),
    };
  }
}
