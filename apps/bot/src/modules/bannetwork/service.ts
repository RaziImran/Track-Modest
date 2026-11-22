// §15.5 Shared ban network — pure service layer (no discord.js imports).
export type BanAction = "alert" | "require_verification" | "ban";

export const SHAREABLE_CATEGORIES = ["scam", "raid", "nsfw-spam"] as const;

export type ShareableCategory = (typeof SHAREABLE_CATEGORIES)[number];

export function isShareableCategory(category: string): category is ShareableCategory {
  return SHAREABLE_CATEGORIES.includes(category as ShareableCategory);
}

export interface BanListEntryRow {
  id: number;
  userId: string;
  sourceGuildId: string;
  category: string;
  evidence: string;
  confirmedBy: number;
  status: string; // "pending" | "active" | "appealed" | "removed"
  createdAt: Date;
}

export interface BanNetworkServiceDeps {
  createEntry: (input: {
    userId: string;
    sourceGuildId: string;
    category: string;
    evidence: string;
  }) => Promise<BanListEntryRow>;
  findEntryByUserCategory: (userId: string, category: string) => Promise<BanListEntryRow | null>;
  findActiveEntryByUserId: (userId: string) => Promise<BanListEntryRow | null>;
  incrementConfirmation: (id: number) => Promise<BanListEntryRow>;
  setStatus: (id: number, status: string) => Promise<void>;
  getActiveEntries: () => Promise<BanListEntryRow[]>;
  isNetworkEnabled: (guildId: string) => Promise<boolean>;
  getJoinAction: (guildId: string) => Promise<BanAction>;
}

// §15.5: entries become active only after 2 different guilds independently ban
// the same user in a shareable category.
const CONFIRMATION_THRESHOLD = 2;

export class BanNetworkService {
  public deps: BanNetworkServiceDeps;

  constructor(deps: BanNetworkServiceDeps) {
    this.deps = deps;
  }

  /** Called after a successful categorized ban. Reports to the ban network. */
  async reportBan(input: {
    guildId: string;
    userId: string;
    category: string;
    reason: string;
  }): Promise<{ entry: BanListEntryRow | null; active: boolean; confirmedBy: number }> {
    const enabled = await this.deps.isNetworkEnabled(input.guildId);
    if (!enabled) return { entry: null, active: false, confirmedBy: 0 };
    if (!isShareableCategory(input.category)) {
      return { entry: null, active: false, confirmedBy: 0 };
    }

    const existing = await this.deps.findEntryByUserCategory(input.userId, input.category);
    if (existing) {
      const updated = await this.deps.incrementConfirmation(existing.id);
      let status = updated.status;
      if (updated.confirmedBy >= CONFIRMATION_THRESHOLD && updated.status !== "active") {
        await this.deps.setStatus(updated.id, "active");
        status = "active";
      }
      return { entry: { ...updated, status }, active: status === "active", confirmedBy: updated.confirmedBy };
    }

    const created = await this.deps.createEntry({
      userId: input.userId,
      sourceGuildId: input.guildId,
      category: input.category,
      evidence: input.reason,
    });
    return { entry: created, active: false, confirmedBy: created.confirmedBy };
  }

  /** Returns the active network listing for a user, if any (network-wide). */
  async findListedUser(userId: string): Promise<BanListEntryRow | null> {
    return this.deps.findActiveEntryByUserId(userId);
  }

  /** The action a participating guild should take on a listed user's join (guild setting). */
  async getJoinAction(guildId: string): Promise<BanAction> {
    return this.deps.getJoinAction(guildId);
  }
}
