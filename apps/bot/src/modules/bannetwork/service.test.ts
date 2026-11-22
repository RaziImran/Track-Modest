// §15.5 Shared ban network — pure service layer tests.
import { describe, it, expect, vi } from "vitest";
import { BanNetworkService, isShareableCategory } from "./service.js";
import type { BanListEntryRow } from "./service.js";

const entryRow = (overrides: Partial<BanListEntryRow> = {}): BanListEntryRow => ({
  id: 1,
  userId: "u1",
  sourceGuildId: "g1",
  category: "scam",
  evidence: "spamming scam links",
  confirmedBy: 1,
  status: "pending",
  createdAt: new Date("2026-11-22T12:00:00Z"),
  ...overrides,
});

const baseDeps = () => ({
  createEntry: vi.fn(),
  findEntryByUserCategory: vi.fn(),
  findActiveEntryByUserId: vi.fn(),
  incrementConfirmation: vi.fn(),
  setStatus: vi.fn(),
  getActiveEntries: vi.fn(),
  isNetworkEnabled: vi.fn(),
  getJoinAction: vi.fn(),
});

describe("BanNetworkService", () => {
  describe("isShareableCategory", () => {
    it("returns true for scam, raid, nsfw-spam", () => {
      expect(isShareableCategory("scam")).toBe(true);
      expect(isShareableCategory("raid")).toBe(true);
      expect(isShareableCategory("nsfw-spam")).toBe(true);
    });

    it("returns false for other categories", () => {
      expect(isShareableCategory("spam")).toBe(false);
      expect(isShareableCategory("")).toBe(false);
    });
  });

  describe("reportBan", () => {
    it("does nothing when network is not enabled for the guild", async () => {
      const deps = baseDeps();
      deps.isNetworkEnabled.mockResolvedValue(false);
      const service = new BanNetworkService(deps);

      const result = await service.reportBan({
        guildId: "g1",
        userId: "u1",
        category: "scam",
        reason: "scam links",
      });

      expect(result).toEqual({ entry: null, active: false, confirmedBy: 0 });
      expect(deps.createEntry).not.toHaveBeenCalled();
    });

    it("does nothing for non-shareable categories", async () => {
      const deps = baseDeps();
      deps.isNetworkEnabled.mockResolvedValue(true);
      const service = new BanNetworkService(deps);

      const result = await service.reportBan({
        guildId: "g1",
        userId: "u1",
        category: "spam",
        reason: "spam",
      });

      expect(result).toEqual({ entry: null, active: false, confirmedBy: 0 });
      expect(deps.createEntry).not.toHaveBeenCalled();
    });

    it("creates a pending entry for the first ban (not yet active)", async () => {
      const deps = baseDeps();
      deps.isNetworkEnabled.mockResolvedValue(true);
      deps.findEntryByUserCategory.mockResolvedValue(null);
      deps.createEntry.mockResolvedValue(entryRow({ confirmedBy: 1, status: "pending" }));
      const service = new BanNetworkService(deps);

      const result = await service.reportBan({
        guildId: "g1",
        userId: "u1",
        category: "scam",
        reason: "scam links",
      });

      expect(deps.createEntry).toHaveBeenCalledTimes(1);
      expect(deps.createEntry).toHaveBeenCalledWith({
        userId: "u1",
        sourceGuildId: "g1",
        category: "scam",
        evidence: "scam links",
      });
      expect(result.active).toBe(false);
      expect(result.confirmedBy).toBe(1);
    });

    it("activates the entry when a second guild confirms the same user+category", async () => {
      const deps = baseDeps();
      deps.isNetworkEnabled.mockResolvedValue(true);
      deps.findEntryByUserCategory.mockResolvedValue(entryRow({ confirmedBy: 1, status: "pending" }));
      deps.incrementConfirmation.mockResolvedValue(entryRow({ confirmedBy: 2, status: "pending" }));
      deps.setStatus.mockResolvedValue(undefined);
      const service = new BanNetworkService(deps);

      const result = await service.reportBan({
        guildId: "g2",
        userId: "u1",
        category: "scam",
        reason: "scam links",
      });

      expect(deps.incrementConfirmation).toHaveBeenCalledWith(1);
      expect(deps.setStatus).toHaveBeenCalledWith(1, "active");
      expect(result.active).toBe(true);
      expect(result.confirmedBy).toBe(2);
    });

    it("keeps the entry active on further confirmations without resetting", async () => {
      const deps = baseDeps();
      deps.isNetworkEnabled.mockResolvedValue(true);
      deps.findEntryByUserCategory.mockResolvedValue(entryRow({ confirmedBy: 2, status: "active" }));
      deps.incrementConfirmation.mockResolvedValue(entryRow({ confirmedBy: 3, status: "active" }));
      const service = new BanNetworkService(deps);

      const result = await service.reportBan({
        guildId: "g3",
        userId: "u1",
        category: "raid",
        reason: "raid join",
      });

      expect(deps.setStatus).not.toHaveBeenCalled();
      expect(result.active).toBe(true);
      expect(result.confirmedBy).toBe(3);
    });
  });

  describe("findListedUser", () => {
    it("delegates to findActiveEntryByUserId", async () => {
      const findActiveEntryByUserId = vi.fn().mockResolvedValue(entryRow({ status: "active" }));
      const deps = { ...baseDeps(), findActiveEntryByUserId };
      const service = new BanNetworkService(deps);

      const result = await service.findListedUser("u1");

      expect(findActiveEntryByUserId).toHaveBeenCalledWith("u1");
      expect(result).toEqual(entryRow({ status: "active" }));
    });
  });

  describe("getJoinAction", () => {
    it("delegates to deps.getJoinAction", async () => {
      const getJoinAction = vi.fn().mockResolvedValue("ban");
      const deps = { ...baseDeps(), getJoinAction };
      const service = new BanNetworkService(deps);

      const result = await service.getJoinAction("g1");

      expect(getJoinAction).toHaveBeenCalledWith("g1");
      expect(result).toBe("ban");
    });
  });
});
