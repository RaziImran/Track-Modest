import { describe, it, expect } from "vitest";
import {
  formatContent,
  formatAttachments,
  formatBytes,
  resolveLogChannel,
  shouldIgnore,
  shouldLogCategory,
  extractMessageData,
  getMessageUrl,
  formatMemberJoin,
  formatMemberLeave,
  formatNicknameChange,
  formatAvatarChange,
  LOG_COLORS,
  LOG_CATEGORY_COLORS,
} from "./service.js";
import type { GuildLoggingConfig } from "./repository.js";
import type { MemberJoinLogData, MemberLeaveLogData, NicknameChangeLogData, AvatarChangeLogData } from "./service.js";

const mockGuildConfig: GuildLoggingConfig = {
  guildId: "guild123",
  modules: { logging: true },
  logChannels: { messages: "channel123" },
  overrides: {
    logging: {
      verbosity: "all",
      ignoredChannels: ["ignored-channel"],
      ignoredRoles: ["ignored-role"],
      ghostPingNotify: false,
    },
  },
  sizeTier: "SMALL",
};

describe("logging service", () => {
  describe("formatContent", () => {
    it("returns placeholder for null content", () => {
      expect(formatContent(null)).toBe("*(no text content)*");
    });

    it("returns content as-is when under max length", () => {
      expect(formatContent("hello")).toBe("hello");
    });

    it("truncates content over max length", () => {
      const longContent = "a".repeat(1030);
      const result = formatContent(longContent, 1024);
      expect(result.length).toBe(1024);
      expect(result.endsWith("...")).toBe(true);
    });
  });

  describe("formatAttachments", () => {
    it("returns placeholder for empty attachments", () => {
      expect(formatAttachments([])).toBe("*(none)*");
    });

    it("formats attachments with name, url, and size", () => {
      const attachments = [
        { name: "test.png", url: "https://example.com/test.png", size: 1024 },
        { name: "test2.png", url: "https://example.com/test2.png", size: 2048 },
      ];
      const result = formatAttachments(attachments);
      expect(result).toContain("[test.png](https://example.com/test.png)");
      expect(result).toContain("1KB");
      expect(result).toContain("[test2.png](https://example.com/test2.png)");
      expect(result).toContain("2KB");
    });
  });

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(500)).toBe("500B");
      expect(formatBytes(1024)).toBe("1KB");
      expect(formatBytes(1536)).toBe("1.5KB");
      expect(formatBytes(1024 * 1024)).toBe("1MB");
      expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5MB");
    });
  });

  describe("resolveLogChannel", () => {
    it("returns channel ID when category is enabled", () => {
      const result = resolveLogChannel(mockGuildConfig, "messages");
      expect(result).toBe("channel123");
    });

    it("returns null when category is not configured", () => {
      const result = resolveLogChannel(mockGuildConfig, "members");
      expect(result).toBeNull();
    });

    it("returns null when logging module is disabled", () => {
      const config: GuildLoggingConfig = { ...mockGuildConfig, modules: { logging: false } };
      const result = resolveLogChannel(config, "messages");
      expect(result).toBeNull();
    });
  });

  describe("shouldIgnore", () => {
    it("returns true for bot messages", () => {
      expect(shouldIgnore(mockGuildConfig, "channel123", "bot123", [], true)).toBe(true);
    });

    it("returns true for ignored channel", () => {
      expect(shouldIgnore(mockGuildConfig, "ignored-channel", "user123", [], false)).toBe(true);
    });

    it("returns true for ignored role", () => {
      expect(shouldIgnore(mockGuildConfig, "channel123", "user123", ["ignored-role"], false)).toBe(true);
    });

    it("returns false for normal messages", () => {
      expect(shouldIgnore(mockGuildConfig, "channel123", "user123", ["other-role"], false)).toBe(false);
    });
  });

  describe("shouldLogCategory", () => {
    it("returns true when module enabled and channel configured", () => {
      expect(shouldLogCategory(mockGuildConfig, "messages")).toBe(true);
    });

    it("returns false when module disabled", () => {
      const config: GuildLoggingConfig = { ...mockGuildConfig, modules: { logging: false } };
      expect(shouldLogCategory(config, "messages")).toBe(false);
    });

    it("returns false when channel not configured", () => {
      expect(shouldLogCategory(mockGuildConfig, "members")).toBe(false);
    });
  });

  describe("extractMessageData", () => {
    it("extracts content and attachments from message", () => {
      const mockMessage = {
        content: "test message",
        attachments: new Map([
          ["att1", { name: "test.png", url: "https://example.com/test.png", size: 1024 }],
        ]),
      } as any;

      const result = extractMessageData(mockMessage, true);

      expect(result.content).toBe("test message");
      expect(result.attachments).toHaveLength(1);
      const firstAttachment = result.attachments[0];
      expect(firstAttachment).toBeDefined();
      expect(firstAttachment!.name).toBe("test.png");
    });

    it("handles messages with no content", () => {
      const mockMessage = {
        content: "",
        attachments: new Map(),
      } as any;

      const result = extractMessageData(mockMessage, true);

      expect(result.content).toBeNull();
      expect(result.attachments).toHaveLength(0);
    });
  });

  describe("getMessageUrl", () => {
    it("generates correct Discord message URL", () => {
      const url = getMessageUrl("guild123", "channel123", "msg123");
      expect(url).toBe("https://discord.com/channels/guild123/channel123/msg123");
    });
  });

  describe("LOG_COLORS", () => {
    it("has correct color values", () => {
      expect(LOG_COLORS.BRAND).toBe(0x7c5cff);
      expect(LOG_COLORS.SUCCESS).toBe(0x3ba55d);
      expect(LOG_COLORS.DANGER).toBe(0xed4245);
      expect(LOG_COLORS.WARNING).toBe(0xfaa61a);
      expect(LOG_COLORS.INFO).toBe(0x5865f2);
    });
  });

  describe("LOG_CATEGORY_COLORS", () => {
    it("has correct category colors", () => {
      expect(LOG_CATEGORY_COLORS["messages"]).toBe(LOG_COLORS.INFO);
      expect(LOG_CATEGORY_COLORS["moderation"]).toBe(LOG_COLORS.DANGER);
      expect(LOG_CATEGORY_COLORS["automod"]).toBe(LOG_COLORS.DANGER);
    });
  });

  describe("formatMemberJoin", () => {
    it("returns member join data unchanged", () => {
      const data: MemberJoinLogData = {
        guildId: "guild123",
        userId: "user123",
        userTag: "TestUser#1234",
        userAvatarUrl: "https://example.com/avatar.png",
        accountAge: 86400000,
        inviteUsed: "invite123",
        timestamp: Date.now(),
      };

      const result = formatMemberJoin(data);
      expect(result).toEqual(data);
    });
  });

  describe("formatMemberLeave", () => {
    it("returns member leave data unchanged", () => {
      const data: MemberLeaveLogData = {
        guildId: "guild123",
        userId: "user123",
        userTag: "TestUser#1234",
        userAvatarUrl: "https://example.com/avatar.png",
        roles: "<@&role1>, <@&role2>",
        timestamp: Date.now(),
      };

      const result = formatMemberLeave(data);
      expect(result).toEqual(data);
    });
  });

  describe("formatNicknameChange", () => {
    it("returns nickname change data unchanged", () => {
      const data: NicknameChangeLogData = {
        guildId: "guild123",
        userId: "user123",
        userTag: "TestUser#1234",
        userAvatarUrl: "https://example.com/avatar.png",
        oldNickname: "OldNick",
        newNickname: "NewNick",
        timestamp: Date.now(),
      };

      const result = formatNicknameChange(data);
      expect(result).toEqual(data);
    });
  });

  describe("formatAvatarChange", () => {
    it("returns avatar change data unchanged", () => {
      const data: AvatarChangeLogData = {
        guildId: "guild123",
        userId: "user123",
        userTag: "TestUser#1234",
        userAvatarUrl: "https://example.com/avatar.png",
        oldAvatarUrl: "https://example.com/old.png",
        newAvatarUrl: "https://example.com/new.png",
        timestamp: Date.now(),
      };

      const result = formatAvatarChange(data);
      expect(result).toEqual(data);
    });
  });
});
