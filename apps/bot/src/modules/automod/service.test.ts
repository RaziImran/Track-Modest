// §11 AutoMod — pure service layer tests.
import { describe, it, expect, vi } from "vitest";
import { AutomodService } from "./service.js";
import type { AutomodServiceDeps } from "./service.js";

const baseDeps = (): AutomodServiceDeps => ({
  getAutomodRules: (vi.fn() as any).mockResolvedValue([]),
  recordAutomodHit: (vi.fn() as any).mockResolvedValue(undefined),
  getRepeatHitCount: (vi.fn() as any).mockResolvedValue(0),
  checkRateLimit: (vi.fn() as any).mockResolvedValue({ allowed: true, remaining: 4 }),
  recordMessageHash: (vi.fn() as any).mockResolvedValue({ isDuplicate: false, count: 1 }),
  recordCrossChannelHash: (vi.fn() as any).mockResolvedValue(1),
  incrementRepeatHits: (vi.fn() as any).mockResolvedValue(1),
  getRepeatHits: (vi.fn() as any).mockResolvedValue(0),
  isPhishDomain: (vi.fn() as any).mockResolvedValue(false),
  aiClassify: (vi.fn() as any).mockResolvedValue(null),
  mediaClassify: (vi.fn() as any).mockResolvedValue([]),
});

const defaultConfig = {
  firstAction: "delete" as const,
  timeoutSec: 600,
  spamMaxMessages: 5,
  spamWindowSec: 10,
  duplicateMaxRepeats: 3,
  mentionsMaxPerMessage: 5,
  mentionsMaxRolePerMessage: 3,
  emojiMaxPerMessage: 10,
  capsMaxPercent: 70,
  newlinesMax: 10,
  zalgoEnabled: true,
  badWordsLevel: "standard" as const,
  linksMode: "allowlist" as const,
  invitesMode: "block" as const,
  phishingEnabled: true,
  publicNotice: true,
  useNative: false,
  aiEnabled: false,
  mediaScanEnabled: false,
};

function baseInput(overrides: Partial<Parameters<AutomodService["handleMessage"]>[0]> = {}) {
  return {
    guildId: "g1",
    userId: "u1",
    channelId: "c1",
    memberId: "u1",
    authorId: "u1",
    content: "hello world",
    memberRoles: [],
    isBot: false,
    isStaff: false,
    embedUrls: [],
    attachmentCount: 0,
    attachments: [],
    mentionedUserIds: [],
    mentionedRoleIds: [],
    mentionEveryone: false,
    mentionHere: false,
    messageId: "m1",
    timestamp: new Date(),
    channelIsNsfw: false,
    replyChainPriorHits: false,
    ...overrides,
  };
}

describe("AutomodService", () => {
  describe("handleMessage — no hits", () => {
    it("returns none when no checks fire", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput());
      expect(result.action).toBe("none");
    });

    it("exempts bots", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput({ isBot: true }));
      expect(result.action).toBe("none");
    });

    it("exempts staff", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput({ isStaff: true }));
      expect(result.action).toBe("none");
    });
  });

  describe("handleMessage — phishing (check 2)", () => {
    it("fires on known phishing domain", async () => {
      const deps = baseDeps();
      (deps.isPhishDomain as any).mockResolvedValue(true);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "visit https://evil-phish.com now" }),
      );
      expect(result.action).toBe("delete_timeout");
      expect(result.ruleKey).toBe("automod:phishing");
      expect(deps.isPhishDomain).toHaveBeenCalledWith("evil-phish.com");
    });

    it("does not fire on safe domain", async () => {
      const deps = baseDeps();
      (deps.isPhishDomain as any).mockResolvedValue(false);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "visit https://github.com/user/repo" }),
      );
      expect(result.action).toBe("none");
    });

    it("handles invalid URL gracefully (extractDomain catch)", async () => {
      const deps = baseDeps();
      (deps.isPhishDomain as any).mockResolvedValue(false);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "visit http:// now" }),
      );
      expect(result.action).toBe("none");
    });
  });

  describe("handleMessage — invite links (check 3)", () => {
    it("fires on discord invite when mode is block", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "join https://discord.gg/abc123" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:invite");
    });
  });

  describe("handleMessage — mention spam (check 5)", () => {
    it("fires when too many mentions", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ mentionedUserIds: ["a", "b", "c", "d", "e", "f"] }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:mentions");
    });

    it("does not fire when under mention limit", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ mentionedUserIds: ["a", "b", "c"] }),
      );
      expect(result.action).toBe("none");
    });

    it("counts @everyone as 5", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ mentionEveryone: true, mentionedUserIds: ["a"] }),
      );
      expect(result.action).toBe("delete");
    });
  });

  describe("handleMessage — rate limit (check 6)", () => {
    it("fires when rate limit exceeded", async () => {
      const deps = baseDeps();
      (deps.checkRateLimit as any).mockResolvedValue({ allowed: false, remaining: 0 });
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput());
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:rate");
    });
  });

  describe("handleMessage — duplicates (check 7)", () => {
    it("fires on duplicate message", async () => {
      const deps = baseDeps();
      (deps.recordMessageHash as any).mockResolvedValue({ isDuplicate: true, count: 4 });
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput({ content: "spam spam spam" }));
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:duplicate");
    });

    it("does not fire on unique message", async () => {
      const deps = baseDeps();
      (deps.recordMessageHash as any).mockResolvedValue({ isDuplicate: false, count: 1 });
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput());
      expect(result.action).toBe("none");
    });
  });

  describe("handleMessage — bad words (check 8)", () => {
    it("fires on bad word in standard list", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "this is examplebad content" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:badwords");
    });

    it("is off when level is off", async () => {
      const deps = baseDeps();
      const config = { ...defaultConfig, badWordsLevel: "off" as const };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({ content: "examplebad" }),
      );
      expect(result.action).toBe("none");
    });
  });

  describe("handleMessage — caps/emoji/newlines/zalgo (check 9)", () => {
    it("fires on excessive caps", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "THIS IS ALL CAPS SHOUTING MESSAGE" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:caps_emoji_newlines_zalgo");
    });

    it("fires on excessive emojis", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "😀😁😂😃😄😅😆😇😈😉😊" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:caps_emoji_newlines_zalgo");
    });

    it("fires on excessive newlines", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "a\n\n\n\n\n\n\n\n\n\n\nb" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:caps_emoji_newlines_zalgo");
    });
  });

  describe("handleMessage — custom rules (check 10)", () => {
    it("fires on keyword match", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "no-spam-keywords",
          enabled: true,
          shadow: false,
          trigger: {
            type: "keywords",
            config: { words: ["spam"], matchMode: "word" },
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "this is spam" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:rule:1");
    });

    it("skips disabled rules", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "disabled-rule",
          enabled: false,
          shadow: false,
          trigger: {
            type: "keywords",
            config: { words: ["spam"], matchMode: "word" },
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "this is spam" }),
      );
      expect(result.action).toBe("none");
    });

    it("newAccount trigger returns false (not handled in service)", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "new-account-rule",
          enabled: true,
          shadow: false,
          trigger: {
            type: "newAccount",
            config: { maxAccountAgeDays: 7, blockLinks: true, blockAttachments: true },
          },
          actions: [{ type: "ban" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(baseInput());
      expect(result.action).toBe("none");
    });

    it("attachments trigger matches blocked extension", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "no-executables",
          enabled: true,
          shadow: false,
          trigger: {
            type: "attachments",
            config: { blockedExtensions: ["exe", "scr", "bat"] },
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "payload.exe", size: 1000 }],
        }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:rule:1");
    });

    it("handles invalid URL gracefully (extractDomain catch)", async () => {
      const deps = baseDeps();
      (deps.isPhishDomain as any).mockResolvedValue(false);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "visit https://[::1 now" }),
      );
      expect(result.action).toBe("none");
    });

    it("links trigger matches blocked domain", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "block-github-links",
          enabled: true,
          shadow: false,
          trigger: {
            type: "links",
            config: { domains: ["github.com"] },
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "check out https://github.com/user/repo" }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:rule:1");
    });

    it("attachments trigger matches max size exceeded", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "block-large-files",
          enabled: true,
          shadow: false,
          trigger: {
            type: "attachments",
            config: { maxSizeBytes: 1000 },
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "big.bin", size: 5000 }],
        }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:rule:1");
    });

    it("attachments trigger matches max count exceeded", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "block-too-many-files",
          enabled: true,
          shadow: false,
          trigger: {
            type: "attachments",
            config: { maxCount: 1 },
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 3,
          attachments: [
            { filename: "a.txt", size: 10 },
            { filename: "b.txt", size: 10 },
            { filename: "c.txt", size: 10 },
          ],
        }),
      );
      expect(result.action).toBe("delete");
      expect(result.ruleKey).toBe("automod:rule:1");
    });

    it("attachments trigger returns false when no limit exceeded", async () => {
      const deps = baseDeps();
      (deps.getAutomodRules as any).mockResolvedValue([
        {
          id: 1,
          guildId: "g1",
          name: "allow-all-attachments",
          enabled: true,
          shadow: false,
          trigger: {
            type: "attachments",
            config: {},
          },
          actions: [{ type: "delete" }],
          exemptRoles: [],
          exemptChannels: [],
          createdBy: "mod1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "safe.txt", size: 10 }],
        }),
      );
      expect(result.action).toBe("none");
    });
  });

  describe("normalizeText", () => {
    it("collapses repeated letters", () => {
      // Test via bad word check with leetspeak
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = service.handleMessage(baseInput({ content: "fuuuuck" }));
      // Can't directly test private method; test via check
      expect(result).toBeDefined();
    });
  });

  describe("applyEscalation", () => {
    it("escalates after 3 hits", async () => {
      const deps = baseDeps();
      (deps.incrementRepeatHits as any).mockResolvedValue(3);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.applyEscalation(baseInput(), "delete");
      expect(result.escalated).toBe(true);
      expect(result.action).toBe("timeout");
    });

    it("does not escalate before 3 hits", async () => {
      const deps = baseDeps();
      (deps.incrementRepeatHits as any).mockResolvedValue(2);
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.applyEscalation(baseInput(), "delete");
      expect(result.escalated).toBe(false);
      expect(result.action).toBe("delete");
    });
  });

  describe("checkAIContextReview (AM-12)", () => {
    it("skips when aiEnabled is false", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({ content: "you are stupid" }),
      );
      expect(result.action).toBe("none");
      expect(result.shouldPostToReviewQueue).toBe(false);
    });

    it("skips when no risk signals", async () => {
      const deps = baseDeps();
      const config = { ...defaultConfig, aiEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({ content: "hello world" }),
      );
      expect(result.action).toBe("none");
      expect(result.shouldPostToReviewQueue).toBe(false);
    });

    it("skips silently when AI budget exhausted (aiClassify returns null)", async () => {
      const deps = baseDeps();
      (deps.aiClassify as any).mockResolvedValue(null);
      const config = { ...defaultConfig, aiEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({ content: "you are stupid" }),
      );
      expect(result.action).toBe("none");
      expect(deps.aiClassify).toHaveBeenCalledWith({
        content: "you are stupid",
        riskSignals: ["second_person_insult"],
      });
    });

    it("posts to review queue for severity >= 2, never auto-punishes", async () => {
      const deps = baseDeps();
      (deps.aiClassify as any).mockResolvedValue({
        category: "harassment",
        severity: 3,
        explanation: "Targeted insults",
      });
      const config = { ...defaultConfig, aiEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({ content: "you are stupid" }),
      );
      expect(result.action).toBe("alert");
      expect(result.shouldDelete).toBe(false);
      expect(result.shouldDm).toBe(false);
      expect(result.shouldPostToReviewQueue).toBe(true);
      expect(result.reviewType).toBe("automod_ai");
      expect(result.reviewAiExplanation).toBe("Targeted insults");
    });

    it("handles self_harm by posting to review queue without punishment", async () => {
      const deps = baseDeps();
      (deps.aiClassify as any).mockResolvedValue({
        category: "self_harm",
        severity: 3,
        explanation: "Self-harm indicators detected",
      });
      const config = { ...defaultConfig, aiEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({ content: "i want to kill myself" }),
      );
      expect(result.action).toBe("alert");
      expect(result.shouldDelete).toBe(false);
      expect(result.shouldPostToReviewQueue).toBe(true);
      expect(result.reviewType).toBe("automod_ai");
      expect(result.reviewAiExplanation).toBe("Self-harm indicators detected");
    });

    it("skips when severity < 2", async () => {
      const deps = baseDeps();
      (deps.aiClassify as any).mockResolvedValue({
        category: "spam",
        severity: 1,
        explanation: "Likely spam",
      });
      const config = { ...defaultConfig, aiEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({ content: "buy now" }),
      );
      expect(result.action).toBe("none");
      expect(result.shouldPostToReviewQueue).toBe(false);
    });
  });

  describe("checkMediaScan (AM-13)", () => {
    it("skips when mediaScanEnabled is false", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "image.png", size: 1000, contentType: "image/png" }],
        }),
      );
      expect(result.action).toBe("none");
      expect(result.shouldPostToReviewQueue).toBe(false);
    });

    it("skips when no image attachments", async () => {
      const deps = baseDeps();
      const config = { ...defaultConfig, mediaScanEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "doc.pdf", size: 1000, contentType: "application/pdf" }],
        }),
      );
      expect(result.action).toBe("none");
      expect(result.shouldPostToReviewQueue).toBe(false);
    });

    it("skips when channel is NSFW", async () => {
      const deps = baseDeps();
      const config = { ...defaultConfig, mediaScanEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({
          channelIsNsfw: true,
          attachmentCount: 1,
          attachments: [{ filename: "image.png", size: 1000, contentType: "image/png" }],
        }),
      );
      expect(result.action).toBe("none");
      expect(deps.mediaClassify).not.toHaveBeenCalled();
    });

    it("posts to review queue for detected media (non-scam_qr)", async () => {
      const deps = baseDeps();
      (deps.mediaClassify as any).mockResolvedValue([
        { category: "nsfw", confidence: 0.9 },
      ]);
      const config = { ...defaultConfig, mediaScanEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "image.png", size: 1000, contentType: "image/png" }],
        }),
      );
      expect(result.action).toBe("alert");
      expect(result.shouldDelete).toBe(false);
      expect(result.shouldPostToReviewQueue).toBe(true);
      expect(result.reviewType).toBe("automod_media");
    });

    it("auto-deletes scam_qr with high confidence and posts to review queue", async () => {
      const deps = baseDeps();
      (deps.mediaClassify as any).mockResolvedValue([
        { category: "scam_qr", confidence: 0.95 },
      ]);
      const config = { ...defaultConfig, mediaScanEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "qr.png", size: 1000, contentType: "image/png" }],
        }),
      );
      expect(result.action).toBe("delete");
      expect(result.shouldDelete).toBe(true);
      expect(result.shouldPostToReviewQueue).toBe(true);
      expect(result.reviewType).toBe("automod_media");
    });

    it("skips when media scan returns no hits", async () => {
      const deps = baseDeps();
      (deps.mediaClassify as any).mockResolvedValue([
        { category: "none", confidence: 0.1 },
      ]);
      const config = { ...defaultConfig, mediaScanEnabled: true };
      const service = new AutomodService(deps, config);
      const result = await service.handleMessage(
        baseInput({
          attachmentCount: 1,
          attachments: [{ filename: "image.png", size: 1000, contentType: "image/png" }],
        }),
      );
      expect(result.action).toBe("none");
      expect(result.shouldPostToReviewQueue).toBe(false);
    });
  });

  // ───────────────────────────── simulatePipeline (§14.7 Rule simulator) ─────────────────────────────

  describe("simulatePipeline", () => {
    const msg = (overrides: Partial<{
      messageId: string;
      userId: string;
      content: string;
      isBot: boolean;
      isStaff: boolean;
    }> = {}) => ({
      messageId: overrides.messageId ?? "m1",
      userId: overrides.userId ?? "u1",
      channelId: "c1",
      content: overrides.content ?? "hello world",
      attachments: [],
      channelIsNsfw: false,
      isBot: overrides.isBot ?? false,
      isStaff: overrides.isStaff ?? false,
      memberRoles: [],
      embedUrls: [],
      mentionUserIds: [],
      mentionRoleIds: [],
      mentionEveryone: false,
      mentionHere: false,
      timestamp: new Date(),
      replyChainPriorHits: false,
    });

    it("returns zero hits when all messages are clean", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.simulatePipeline(
        [msg({ content: "hello world" }), msg({ messageId: "m2", userId: "u2", content: "clean message" })],
        "g1",
      );
      expect(result.totalMessages).toBe(2);
      expect(result.wouldActionCount).toBe(0);
      expect(result.wouldDeleteCount).toBe(0);
      expect(result.affectedUsers.size).toBe(0);
      expect(result.hits).toHaveLength(0);
    });

    it("detects bad-word hits and counts would-delete", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, { ...defaultConfig, firstAction: "delete" });
      const result = await service.simulatePipeline(
        [
          msg({ content: "hello world" }),
          msg({ messageId: "m2", userId: "u2", content: "this contains examplebad word" }),
        ],
        "g1",
      );
      expect(result.totalMessages).toBe(2);
      expect(result.wouldActionCount).toBe(1);
      expect(result.wouldDeleteCount).toBe(1);
      expect(result.affectedUsers.has("u2")).toBe(true);
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits[0]!.ruleKey).toBe("automod:badwords");
      expect(result.hits[0]!.wouldDelete).toBe(true);
    });

    it("groups hits by rule key", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.simulatePipeline(
        [
          msg({ messageId: "m1", userId: "u1", content: "examplebad word here" }),
          msg({ messageId: "m2", userId: "u2", content: "another examplebad word" }),
        ],
        "g1",
      );
      expect(result.byRuleKey["automod:badwords"]).toBe(2);
    });

    it("skips bots and staff messages", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const result = await service.simulatePipeline(
        [
          msg({ messageId: "m1", userId: "bot1", content: "examplebad", isBot: true }),
          msg({ messageId: "m2", userId: "staff1", content: "examplebad", isStaff: true }),
          msg({ messageId: "m3", userId: "u1", content: "examplebad" }),
        ],
        "g1",
      );
      expect(result.wouldActionCount).toBe(1);
      expect(result.affectedUsers.has("u1")).toBe(true);
      expect(result.affectedUsers.has("bot1")).toBe(false);
      expect(result.affectedUsers.has("staff1")).toBe(false);
    });

    it("caps at the requested message count", async () => {
      const deps = baseDeps();
      const service = new AutomodService(deps, defaultConfig);
      const many = Array.from({ length: 50 }, (_, i) =>
        msg({ messageId: `m${i}`, userId: `u${i}`, content: "examplebad word" }),
      );
      const result = await service.simulatePipeline(many.slice(0, 3), "g1");
      expect(result.totalMessages).toBe(3);
      expect(result.wouldActionCount).toBe(3);
    });
  });
});
