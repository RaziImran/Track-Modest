import { describe, it, expect } from "vitest";
import { commandDescriptions, getCommandDescription, supportedLocales } from "./commandDescriptions.js";

describe("getCommandDescription", () => {
  it("returns the English description for a registered command", () => {
    expect(getCommandDescription("warn", "en")).toBe("Warn a member and add warning points.");
    expect(getCommandDescription("menu", "en")).toBe(
      "Open your Track Modest hub — profile, quests, games, and more.",
    );
  });

  it("falls back to en when a locale translation is missing", () => {
    expect(getCommandDescription("warn", "es")).toBe("Warn a member and add warning points.");
    expect(getCommandDescription("ban", "pt-BR")).toBe("Ban a user from the server (optionally temporary).");
    expect(getCommandDescription("menu", "id")).toBe(
      "Open your Track Modest hub — profile, quests, games, and more.",
    );
  });

  it("returns an empty string for an unknown command", () => {
    expect(getCommandDescription("nonexistent", "en")).toBe("");
    expect(getCommandDescription("nonexistent", "es")).toBe("");
  });

  it("every registered command has an English description", () => {
    for (const command of Object.keys(commandDescriptions)) {
      expect(getCommandDescription(command, "en")).toBeTruthy();
    }
  });

  it("includes the launch commands", () => {
    expect(Object.keys(commandDescriptions)).toEqual(
      expect.arrayContaining([
        "warn",
        "timeout",
        "untimeout",
        "kick",
        "ban",
        "softban",
        "unban",
        "menu",
      ]),
    );
  });

  it("supportedLocales includes the launch locale en", () => {
    expect(supportedLocales).toContain("en");
  });
});
