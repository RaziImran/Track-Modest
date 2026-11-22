import { prisma } from "@modest/db";
import type { ModCaseType } from "./service.js";

export async function incrementCaseCounter(guildId: string): Promise<number> {
  const counter = await prisma.caseCounter.upsert({
    where: { guildId },
    update: { next: { increment: 1 } },
    create: { guildId, next: 2 },
  });
  return counter.next - 1;
}

export async function createCase(input: {
  guildId: string;
  type: ModCaseType;
  targetId: string;
  moderatorId: string;
  reason?: string;
  durationSec?: number;
  automatic?: boolean;
  ruleKey?: string;
  points?: number;
  caseNumber: number;
}): Promise<{ id: number; number: number }> {
  const created = await prisma.case.create({
    data: {
      guildId: input.guildId,
      number: input.caseNumber,
      type: input.type as any,
      targetId: input.targetId,
      moderatorId: input.moderatorId,
      reason: input.reason ?? "No reason provided",
      durationSec: input.durationSec,
      automatic: input.automatic ?? false,
      ruleKey: input.ruleKey,
      points: input.points ?? 0,
    },
    select: { id: true, number: true },
  });
  return { id: created.id, number: created.number };
}

export async function applyRepPenalty(
  guildId: string,
  userId: string,
  delta: number,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { rep: true },
    });
    const currentRep = member?.rep ?? 0;
    const newRep = Math.max(-500, currentRep + delta);
    await tx.member.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { rep: newRep, cleanSince: new Date() },
      create: { guildId, userId, rep: newRep, cleanSince: new Date() },
    });
    return newRep;
  });
}

export async function getActiveWarnPoints(
  guildId: string,
  userId: string,
  expiryDays: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - expiryDays * 86400000);
  const cases = await prisma.case.findMany({
    where: {
      guildId,
      targetId: userId,
      type: "WARN",
      undone: false,
      createdAt: { gt: cutoff },
    },
    select: { points: true },
  });
  return cases.reduce((sum, c) => sum + c.points, 0);
}

export async function getLadderCasesInWindow(
  guildId: string,
  targetId: string,
  points: number,
  expiryDays: number,
): Promise<ModCaseType[]> {
  const cutoff = new Date(Date.now() - expiryDays * 86400000);
  const cases = await prisma.case.findMany({
    where: {
      guildId,
      targetId,
      ruleKey: `ladder:${points}`,
      createdAt: { gt: cutoff },
    },
    select: { type: true },
  });
  return cases.map((c) => c.type as ModCaseType);
}

export async function setCaseLogMessageId(
  guildId: string,
  caseNumber: number,
  messageId: string,
): Promise<void> {
  await prisma.case.updateMany({
    where: { guildId, number: caseNumber },
    data: { logMessageId: messageId },
  });
}

export async function findCase(
  guildId: string,
  caseNumber: number,
): Promise<{
  id: number;
  number: number;
  type: string;
  targetId: string;
  moderatorId: string;
  reason: string;
  durationSec: number | null;
  points: number;
  undone: boolean;
  undoneBy: string | null;
  undoneAt: Date | null;
  logMessageId: string | null;
  createdAt: Date;
} | null> {
  const found = await prisma.case.findUnique({
    where: { guildId_number: { guildId, number: caseNumber } },
  });
  if (!found) return null;
  return {
    id: found.id,
    number: found.number,
    type: found.type,
    targetId: found.targetId,
    moderatorId: found.moderatorId,
    reason: found.reason,
    durationSec: found.durationSec,
    points: found.points,
    undone: found.undone,
    undoneBy: found.undoneBy,
    undoneAt: found.undoneAt,
    logMessageId: found.logMessageId,
    createdAt: found.createdAt,
  };
}

export async function undoCase(
  guildId: string,
  caseNumber: number,
  undoneBy: string,
): Promise<void> {
  await prisma.case.updateMany({
    where: { guildId, number: caseNumber, undone: false },
    data: { undone: true, undoneBy, undoneAt: new Date() },
  });
}

export async function getUserCases(
  guildId: string,
  targetId: string,
): Promise<{
  id: number;
  number: number;
  type: string;
  targetId: string;
  moderatorId: string;
  reason: string;
  durationSec: number | null;
  points: number;
  undone: boolean;
  undoneBy: string | null;
  undoneAt: Date | null;
  logMessageId: string | null;
  createdAt: Date;
}[]> {
  const found = await prisma.case.findMany({
    where: { guildId, targetId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return found.map((c) => ({
    id: c.id,
    number: c.number,
    type: c.type,
    targetId: c.targetId,
    moderatorId: c.moderatorId,
    reason: c.reason,
    durationSec: c.durationSec,
    points: c.points,
    undone: c.undone,
    undoneBy: c.undoneBy,
    undoneAt: c.undoneAt,
    logMessageId: c.logMessageId,
    createdAt: c.createdAt,
  }));
}
