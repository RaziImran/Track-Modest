// §15.2 Mod Review Queue repository — Prisma operations for ReviewItem.
import { prisma } from "@modest/db";
import type { ReviewQueueServiceDeps } from "./service.js";

export interface ReviewQueueRepositoryDeps {}

export class ReviewQueueRepository {
  constructor(_deps: ReviewQueueRepositoryDeps) {}

  async createReviewItem(input: {
    guildId: string;
    channelId: string;
    type: string;
    targetUserId?: string | null;
    targetUserTag?: string | null;
    evidence: unknown;
    aiExplanation?: string | null;
  }) {
    const row = await prisma.reviewItem.create({
      data: {
        guildId: input.guildId,
        channelId: input.channelId,
        type: input.type,
        targetUserId: input.targetUserId ?? null,
        targetUserTag: input.targetUserTag ?? null,
        evidence: input.evidence as any,
        aiExplanation: input.aiExplanation ?? null,
      },
    });
    return {
      id: row.id.toString(),
      guildId: row.guildId,
      channelId: row.channelId,
      messageId: row.messageId,
      type: row.type as any,
      targetUserId: row.targetUserId,
      targetUserTag: row.targetUserTag,
      evidence: row.evidence,
      aiExplanation: row.aiExplanation,
      status: row.status as any,
      claimedBy: row.claimedBy,
      claimedAt: row.claimedAt,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      resolution: row.resolution as any,
      repostedAt: row.repostedAt,
      createdAt: row.createdAt,
    };
  }

  async getPendingItems(guildId: string) {
    const rows = await prisma.reviewItem.findMany({
      where: { guildId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row: any) => this.mapRow(row));
  }

  async claimItem(id: string, claimedBy: string) {
    const row = await prisma.reviewItem.updateMany({
      where: { id: BigInt(id), status: "PENDING" },
      data: { status: "CLAIMED", claimedBy, claimedAt: new Date() },
    });
    return row.count > 0;
  }

  async resolveItem(id: string, resolution: string, resolvedBy: string) {
    const row = await prisma.reviewItem.updateMany({
      where: { id: BigInt(id), status: { in: ["PENDING", "CLAIMED"] } },
      data: {
        status: "RESOLVED",
        resolution: resolution as any,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });
    return row.count > 0;
  }

  async getItemByMessageId(messageId: string) {
    const row = await prisma.reviewItem.findFirst({
      where: { messageId },
    });
    if (!row) return null;
    return this.mapRow(row);
  }

  async markReposted(id: string) {
    await prisma.reviewItem.update({
      where: { id: BigInt(id) },
      data: { repostedAt: new Date() },
    });
  }

  async getUnresolvedOlderThan(guildId: string, olderThan: Date) {
    const rows = await prisma.reviewItem.findMany({
      where: {
        guildId,
        status: { in: ["PENDING", "CLAIMED"] },
        createdAt: { lt: olderThan },
      },
    });
    return rows.map((row: any) => this.mapRow(row));
  }

  private mapRow(row: any) {
    return {
      id: row.id.toString(),
      guildId: row.guildId,
      channelId: row.channelId,
      messageId: row.messageId,
      type: row.type,
      targetUserId: row.targetUserId,
      targetUserTag: row.targetUserTag,
      evidence: row.evidence,
      aiExplanation: row.aiExplanation,
      status: row.status,
      claimedBy: row.claimedBy,
      claimedAt: row.claimedAt,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      resolution: row.resolution,
      repostedAt: row.repostedAt,
      createdAt: row.createdAt,
    };
  }

  /** Create the service deps from this repository. */
  static createServiceDeps(repo: ReviewQueueRepository): ReviewQueueServiceDeps {
    return {
      createReviewItem: (input: any) => repo.createReviewItem(input),
      getPendingItems: (guildId: string) => repo.getPendingItems(guildId),
      claimItem: (id: string, claimedBy: string) => repo.claimItem(id, claimedBy),
      resolveItem: (id: string, resolution: string, resolvedBy: string) => repo.resolveItem(id, resolution, resolvedBy),
      getItemByMessageId: (messageId: string) => repo.getItemByMessageId(messageId),
      markReposted: (id: string) => repo.markReposted(id),
      getUnresolvedOlderThan: (guildId: string, olderThan: Date) => repo.getUnresolvedOlderThan(guildId, olderThan),
    };
  }
}
