import { describe, it, expect } from "vitest";
import { isModuleEnabled, moduleDisabledMessage } from "./moduleEnabled.js";

describe("isModuleEnabled", () => {
  it("returns true when module is not listed (default enabled)", () => {
    expect(isModuleEnabled({}, "moderation")).toBe(true);
    expect(isModuleEnabled({}, "automod")).toBe(true);
    expect(isModuleEnabled({}, "economy")).toBe(true);
  });

  it("returns true when module is explicitly true", () => {
    expect(isModuleEnabled({ moderation: true }, "moderation")).toBe(true);
    expect(isModuleEnabled({ automod: true, economy: false }, "automod")).toBe(true);
  });

  it("returns false when module is explicitly false", () => {
    expect(isModuleEnabled({ moderation: false }, "moderation")).toBe(false);
    expect(isModuleEnabled({ automod: false, economy: true }, "automod")).toBe(false);
    expect(isModuleEnabled({ automod: false, economy: true }, "economy")).toBe(true);
  });

  it("returns false only for the disabled module, not others", () => {
    const modules = { moderation: false, automod: true };
    expect(isModuleEnabled(modules, "moderation")).toBe(false);
    expect(isModuleEnabled(modules, "automod")).toBe(true);
    expect(isModuleEnabled(modules, "economy")).toBe(true); // not listed -> enabled
  });
});

describe("moduleDisabledMessage", () => {
  it("returns the standard disabled message", () => {
    const msg = moduleDisabledMessage();
    expect(msg).toBe(
      "This feature is turned off on this server. An admin can enable it with /settings.",
    );
  });
});
