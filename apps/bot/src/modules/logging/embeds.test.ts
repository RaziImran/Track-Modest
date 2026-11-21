import { describe, it, expect, vi } from "vitest";
import {
  buildEditEmbed,
  buildDeleteEmbed,
  buildBulkDeleteEmbed,
} from "./embeds.js";
import { LOG_COLORS, LOG_CATEGORY_COLORS } from "./service.js";

const mockT = vi.fn((key: string) => key);

describe("logging embeds", () => {
  describe("buildEditEmbed", () => {
    it("creates embed with before/after content", () => {
      const data = {
        guildId: "guild123",
        channelId: "channel123",
        authorId: "user123",
        authorTag: "TestUser#1234",
        authorAvatarUrl: "https://example.com/avatar.png",
        beforeContent: "hello",
        afterContent: "hello world",
        beforeAttachments: [],
        afterAttachments: [],
        messageUrl: "https://discord.com/channels/guild123/channel123/msg123",
        timestamp: Date.now(),
      };

      const embed = buildEditEmbed(data, mockT);

      expect(embed.data.color).toBe(LOG_CATEGORY_COLORS["messages"]);
      expect(embed.data.author?.name).toBe("TestUser#1234");
      expect(embed.data.title).toBe("logging.edit.title");
      const fields = embed.data.fields;
      expect(fields).toBeDefined();
      expect(fields).toHaveLength(2);
      expect(fields![0]!.name).toBe("logging.edit.before");
      expect(fields![0]!.value).toBe("hello");
      expect(fields![1]!.name).toBe("logging.edit.after");
      expect(fields![1]!.value).toBe("hello world");
    });

    it("includes attachments field when attachments changed", () => {
      const data = {
        guildId: "guild123",
        channelId: "channel123",
        authorId: "user123",
        authorTag: "TestUser#1234",
        authorAvatarUrl: "https://example.com/avatar.png",
        beforeContent: "hello",
        afterContent: "hello world",
        beforeAttachments: ["old.png"],
        afterAttachments: ["new.png"],
        messageUrl: "https://discord.com/channels/guild123/channel123/msg123",
        timestamp: Date.now(),
      };

      const embed = buildEditEmbed(data, mockT);

      const fields = embed.data.fields;
      expect(fields).toBeDefined();
      expect(fields).toHaveLength(3);
      expect(fields![2]!.name).toBe("logging.edit.attachments");
    });
  });

  describe("buildDeleteEmbed", () => {
    it("creates embed for cached message", () => {
      const data = {
        guildId: "guild123",
        channelId: "channel123",
        authorId: "user123",
        authorTag: "TestUser#1234",
        authorAvatarUrl: "https://example.com/avatar.png",
        content: "deleted message",
        attachments: [{ name: "test.png", url: "https://example.com/test.png", size: 1024 }],
        messageUrl: "https://discord.com/channels/guild123/channel123/msg123",
        timestamp: Date.now(),
        wasCached: true,
      };

      const embed = buildDeleteEmbed(data, mockT);

      expect(embed.data.color).toBe(LOG_CATEGORY_COLORS["messages"]);
      expect(embed.data.author?.name).toBe("TestUser#1234");
      expect(embed.data.title).toBe("logging.delete.title");
      const fields = embed.data.fields;
      expect(fields).toBeDefined();
      expect(fields).toHaveLength(2);
      expect(fields![0]!.name).toBe("logging.delete.content");
      expect(fields![0]!.value).toBe("deleted message");
      expect(fields![1]!.name).toBe("logging.delete.attachments");
    });

    it("shows not cached warning for uncached messages", () => {
      const data = {
        guildId: "guild123",
        channelId: "channel123",
        authorId: "user123",
        authorTag: "TestUser#1234",
        authorAvatarUrl: "https://example.com/avatar.png",
        content: null,
        attachments: [],
        messageUrl: "https://discord.com/channels/guild123/channel123/msg123",
        timestamp: Date.now(),
        wasCached: false,
      };

      const embed = buildDeleteEmbed(data, mockT);

      expect(embed.data.color).toBe(LOG_COLORS.WARNING);
      const fields = embed.data.fields;
      expect(fields).toBeDefined();
      expect(fields).toHaveLength(2);
      expect(fields![1]!.name).toBe("logging.delete.notCached");
      expect(fields![1]!.value).toBe("logging.delete.contentUnavailable");
    });
  });

  describe("buildBulkDeleteEmbed", () => {
    it("creates embed and attachment for bulk delete", () => {
      const data = {
        guildId: "guild123",
        channelId: "channel123",
        messageCount: 2,
        messages: [
          {
            authorId: "user1",
            authorTag: "User1#1234",
            content: "message 1",
            attachments: [],
            timestamp: Date.now() - 1000,
          },
          {
            authorId: "user2",
            authorTag: "User2#5678",
            content: "message 2",
            attachments: [{ name: "img.png", url: "https://example.com/img.png", size: 2048 }],
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };

      const { embed, attachment } = buildBulkDeleteEmbed(data, mockT);

      expect(embed.data.color).toBe(LOG_CATEGORY_COLORS["messages"]);
      expect(embed.data.title).toBe("logging.bulkDelete.title");
      expect(attachment.name).toMatch(/bulk-delete-channel123-\d+\.txt/);
      expect(attachment.description).toBe("logging.bulkDelete.attachmentDesc");
    });
  });
});
