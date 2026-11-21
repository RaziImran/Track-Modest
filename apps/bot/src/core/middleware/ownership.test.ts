import { describe, it, expect } from "vitest";
import { embedOwnerId, checkOwnership, recheckPermission } from "./ownership.js";

describe("ownership", () => {
  it("embeds owner id", () => {
    expect(embedOwnerId("mod:undo:4821", "999")).toBe("mod:undo:4821:999");
  });

  it("returns true when caller is owner", () => {
    expect(checkOwnership("mod:undo:4821:999", "999")).toBe(true);
  });

  it("returns false when caller is not owner", () => {
    expect(checkOwnership("mod:undo:4821:999", "111")).toBe(false);
  });

  it("throws on invalid customId", () => {
    expect(() => checkOwnership("onlyone", "999")).toThrow();
  });

  it("throws when exceeding 100 chars", () => {
    // 97 + ":" + "999" = 101 chars > 100
    const long = "a".repeat(97);
    expect(() => embedOwnerId(long, "999")).toThrow();
  });

  it("allows exactly 100 chars", () => {
    // 96 + ":" + "999" = 100 chars, exactly at the limit
    const long = "a".repeat(96);
    expect(() => embedOwnerId(long, "999")).not.toThrow();
  });

  it("recheckPermission guild-only throws", () => {
    expect(() => recheckPermission({ guildId: null, member: { permissions: { has: () => true } } }, "ManageGuild")).toThrow();
  });
});
