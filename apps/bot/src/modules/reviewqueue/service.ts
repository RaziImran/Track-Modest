// §15.2 Mod Review Queue — pure service layer (no discord.js imports).
export type ReviewType = "automod_ai" | "automod_media" | "report_escalated" | "held_message";

export type ReviewResolution = "approve" | "reject" | "ignore";

export interface ReviewItemRow {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  type: ReviewType;
  targetUserId: string | null;
  targetUserTag: string | null;
  evidence: unknown;
  aiExplanation: string | null;
  status: "PENDING" | "CLAIMED" | "RESOLVED" | "EXPIRED";
  claimedBy: string | null;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution: ReviewResolution | null;
  repostedAt: Date | null;
  createdAt: Date;
}

export interface ReviewQueueServiceDeps {
  createReviewItem: (input: {
    guildId: string;
    channelId: string;
    type: ReviewType;
    targetUserId?: string | null;
    targetUserTag?: string | null;
    evidence: unknown;
    aiExplanation?: string | null;
  }) => Promise<ReviewItemRow>;
  getPendingItems: (guildId: string) => Promise<ReviewItemRow[]>;
  claimItem: (id: string, claimedBy: string) => Promise<boolean>;
  resolveItem: (id: string, resolution: ReviewResolution, resolvedBy: string) => Promise<boolean>;
  getItemByMessageId: (messageId: string) => Promise<ReviewItemRow | null>;
  markReposted: (id: string) => Promise<void>;
  getUnresolvedOlderThan: (guildId: string, olderThan: Date) => Promise<ReviewItemRow[]>;
}

export class ReviewQueueService {
  public deps: ReviewQueueServiceDeps;

  constructor(deps: ReviewQueueServiceDeps) {
    this.deps = deps;
  }

  /** Create a review queue item. */
  async createItem(input: {
    guildId: string;
    channelId: string;
    type: ReviewType;
    targetUserId?: string | null;
    targetUserTag?: string | null;
    evidence: unknown;
    aiExplanation?: string | null;
  }): Promise<ReviewItemRow> {
    return this.deps.createReviewItem(input);
  }

  /** Claim an item for a staff member. Returns true if claimed successfully. */
  async claimItem(id: string, claimedBy: string): Promise<boolean> {
    return this.deps.claimItem(id, claimedBy);
  }

  /** Resolve an item with a resolution. Returns true if resolved successfully. */
  async resolveItem(
    id: string,
    resolution: ReviewResolution,
    resolvedBy: string,
  ): Promise<boolean> {
    return this.deps.resolveItem(id, resolution, resolvedBy);
  }

  /** Get all pending items for a guild. */
  async getPendingItems(guildId: string): Promise<ReviewItemRow[]> {
    return this.deps.getPendingItems(guildId);
  }

  /** Format a human-readable summary of the item for the mod-queue message. */
  formatItemSummary(item: ReviewItemRow): string {
    const target = item.targetUserTag
      ? `<@${item.targetUserId}> (${item.targetUserTag})`
      : "unknown user";
    const evidenceStr = JSON.stringify(item.evidence);
    const aiPart = item.aiExplanation
      ? `\nAI suggestion (may be wrong): ${item.aiExplanation}`
      : "";
    return `**Type:** ${item.type}\n**Target:** ${target}\n**Evidence:** ${evidenceStr}${aiPart}\n**Status:** ${item.status}`;
  }

  /** Build claim/resolve buttons for a review item. customId: review:claim:<id>, review:resolve:<id>:<resolution> */
  static buildClaimButtons(itemId: string): string[] {
    return [
      `review:claim:${itemId}`,
      `review:resolve:${itemId}:approve`,
      `review:resolve:${itemId}:reject`,
      `review:resolve:${itemId}:ignore`,
    ];
  }
}
