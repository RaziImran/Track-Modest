import { describe, it, expect } from "vitest";
import {
  buildHubView,
  computeRedDots,
  resolveVisibleActions,
  buildHubButtons,
  buttonCustomId,
  chunk,
  HUB_ACTION_DEFS,
  RED_DOT,
  type HubProfile,
  type HubTodayStats,
  type HubNewItems,
} from "./service.js";

const profile: HubProfile = {
  displayName: "Maya",
  level: 12,
  xpIntoLevel: 340,
  xpForNextLevel: 1000,
  coins: 1234,
  rep: 89,
  bond: 45,
  streak: 12,
  seasonTier: 14,
  seasonTierMax: 50,
};

const today: HubTodayStats = {
  questsDone: 2,
  questsTotal: 3,
  dailyRewardReady: true,
};

const noNew: HubNewItems = {
  dailyReward: false,
  completedQuest: false,
  newBadge: false,
  novaMessage: false,
};

describe("RED_DOT", () => {
  it("is the red circle emoji", () => {
    expect(RED_DOT).toBe("\u{1F534}");
  });
});

describe("HUB_ACTION_DEFS", () => {
  it("declares claimDaily as primary and serverSettings as staff only", () => {
    const claim = HUB_ACTION_DEFS.find((d) => d.action === "claimDaily");
    expect(claim?.style).toBe("primary");
    const settings = HUB_ACTION_DEFS.find((d) => d.action === "serverSettings");
    expect(settings?.staffOnly).toBe(true);
  });

  it("keeps claimDaily before games before serverSettings (display order)", () => {
    const actions = HUB_ACTION_DEFS.map((d) => d.action);
    expect(actions.indexOf("claimDaily")).toBeLessThan(actions.indexOf("games"));
    expect(actions.indexOf("games")).toBeLessThan(actions.indexOf("serverSettings"));
  });

  it("gives each action a distinct customId via buttonCustomId", () => {
    const ids = HUB_ACTION_DEFS.map((d) => buttonCustomId(d.action));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buttonCustomId", () => {
  it("builds hub:tab:<action>", () => {
    expect(buttonCustomId("games")).toBe("hub:tab:games");
    expect(buttonCustomId("serverSettings")).toBe("hub:tab:serverSettings");
  });
});

describe("chunk", () => {
  it("splits into rows of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns the whole list when size <= 0", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
  it("returns an empty list for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("resolveVisibleActions", () => {
  it("hides serverSettings for non-staff", () => {
    const actions = resolveVisibleActions(false);
    expect(actions).not.toContain("serverSettings");
    expect(actions).toContain("games");
  });

  it("includes serverSettings for staff", () => {
    const actions = resolveVisibleActions(true);
    expect(actions).toContain("serverSettings");
  });

  it("always includes claimDaily, nova, games, quests", () => {
    for (const isStaff of [true, false]) {
      const actions = resolveVisibleActions(isStaff);
      expect(actions).toEqual(expect.arrayContaining(["claimDaily", "nova", "games", "quests"]));
    }
  });
});

describe("computeRedDots", () => {
  it("flags every action with false by default", () => {
    const redDots = computeRedDots(noNew, { questsDone: 0, questsTotal: 3, dailyRewardReady: false });
    for (const def of HUB_ACTION_DEFS) {
      expect(redDots[def.action]).toBe(false);
    }
  });

  it("flags claimDaily when the daily reward is ready", () => {
    const redDots = computeRedDots(noNew, today);
    expect(redDots.claimDaily).toBe(true);
  });

  it("does not flag claimDaily from the newItems.dailyReward flag alone (uses today)", () => {
    const redDots = computeRedDots(
      { ...noNew, dailyReward: true },
      { questsDone: 0, questsTotal: 3, dailyRewardReady: false },
    );
    expect(redDots.claimDaily).toBe(false);
  });

  it("flags nova when there is a new Nova message", () => {
    const redDots = computeRedDots({ ...noNew, novaMessage: true }, today);
    expect(redDots.nova).toBe(true);
  });

  it("flags quests when a quest is complete", () => {
    const redDots = computeRedDots({ ...noNew, completedQuest: true }, today);
    expect(redDots.quests).toBe(true);
  });

  it("flags badges when there is a new badge", () => {
    const redDots = computeRedDots({ ...noNew, newBadge: true }, today);
    expect(redDots.badges).toBe(true);
  });

  it("never flags games, leaderboards, shop, inventory, serverSettings", () => {
    const redDots = computeRedDots(
      { dailyReward: true, completedQuest: true, newBadge: true, novaMessage: true },
      { questsDone: 3, questsTotal: 3, dailyRewardReady: true },
    );
    expect(redDots.games).toBe(false);
    expect(redDots.leaderboards).toBe(false);
    expect(redDots.shop).toBe(false);
    expect(redDots.inventory).toBe(false);
    expect(redDots.serverSettings).toBe(false);
  });

  it("returns a boolean for every tab action", () => {
    const redDots = computeRedDots(noNew, today);
    for (const def of HUB_ACTION_DEFS) {
      expect(typeof redDots[def.action]).toBe("boolean");
    }
  });
});

describe("buildHubButtons", () => {
  const redDots = computeRedDots({ ...noNew, novaMessage: true, newBadge: true }, today);

  it("produces one button per visible action with correct customId and labelKey", () => {
    const buttons = buildHubButtons(["claimDaily", "games"], redDots);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatchObject({
      action: "claimDaily",
      customId: "hub:tab:claimDaily",
      style: "primary",
      labelKey: "hub.tab.claimDaily",
    });
    expect(buttons[1]).toMatchObject({
      action: "games",
      customId: "hub:tab:games",
      labelKey: "hub.tab.games",
    });
  });

  it("copies the redDot flag onto the matching button", () => {
    const buttons = buildHubButtons(["nova", "badges", "games"], redDots);
    expect(buttons.find((b) => b.action === "nova")?.redDot).toBe(true);
    expect(buttons.find((b) => b.action === "badges")?.redDot).toBe(true);
    expect(buttons.find((b) => b.action === "games")?.redDot).toBe(false);
  });

  it("defaults missing redDot entries to false", () => {
    const empty: Record<string, boolean> = {};
    const buttons = buildHubButtons(["games"], empty as never);
    expect(buttons[0]?.redDot).toBe(false);
  });

  it("keeps every customId under Discord's 100 char limit", () => {
    const buttons = buildHubButtons(resolveVisibleActions(true), redDots);
    for (const b of buttons) {
      expect(b.customId.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("buildHubView", () => {
  it("returns the brand color and hub title key", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: false });
    expect(view.color).toBe("brand");
    expect(view.titleKey).toBe("hub.title");
  });

  it("greets the user by name and shows the streak when present", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: false });
    expect(view.greeting).toContain("Maya");
    expect(view.greeting).toContain("12-day streak");
  });

  it("omits the streak text when the streak is zero", () => {
    const view = buildHubView({
      profile: { ...profile, streak: 0 },
      today,
      newItems: noNew,
      isStaff: false,
    });
    expect(view.greeting).toBe("Hi, Maya!");
  });

  it("builds level, wallet and season fields when the profile card is shown", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: false });
    const names = view.fields.map((f) => f.name);
    expect(names).toContain("hub.field.level");
    expect(names).toContain("hub.field.wallet");
    expect(names).toContain("hub.field.season");
    const level = view.fields.find((f) => f.name === "hub.field.level");
    expect(level?.value).toContain("Level 12");
  });

  it("omits profile fields when showProfileCard is false", () => {
    const view = buildHubView({
      profile,
      today,
      newItems: noNew,
      isStaff: false,
      showProfileCard: false,
    });
    expect(view.fields.map((f) => f.name)).not.toContain("hub.field.level");
  });

  it("builds a today field summarising quests and daily reward", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: false });
    const todayField = view.fields.find((f) => f.name === "hub.field.today");
    expect(todayField?.value).toContain("2/3 quests done");
    expect(todayField?.value).toContain("Daily reward ready");
  });

  it("omits the today field when showTodayStats is false", () => {
    const view = buildHubView({
      profile,
      today,
      newItems: noNew,
      isStaff: false,
      showTodayStats: false,
    });
    expect(view.fields.map((f) => f.name)).not.toContain("hub.field.today");
  });

  it("hides the serverSettings button for non-staff", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: false });
    expect(view.buttons.map((b) => b.action)).not.toContain("serverSettings");
  });

  it("shows the serverSettings button for staff", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: true });
    expect(view.buttons.map((b) => b.action)).toContain("serverSettings");
  });

  it("carries red dots onto the right buttons", () => {
    const view = buildHubView({
      profile,
      today,
      newItems: { ...noNew, novaMessage: true, completedQuest: true },
      isStaff: false,
    });
    expect(view.buttons.find((b) => b.action === "nova")?.redDot).toBe(true);
    expect(view.buttons.find((b) => b.action === "quests")?.redDot).toBe(true);
    expect(view.buttons.find((b) => b.action === "games")?.redDot).toBe(false);
  });

  it("builds rows of at most 5 buttons (Discord action row limit)", () => {
    const view = buildHubView({ profile, today, newItems: noNew, isStaff: true });
    const rows = chunk(view.buttons, 5);
    for (const row of rows) {
      expect(row.length).toBeLessThanOrEqual(5);
    }
    // 9 actions (8 + staff) -> 2 rows
    expect(rows).toHaveLength(2);
  });

  it("renders an empty XP bar when xpForNextLevel is non-positive", () => {
    const view = buildHubView({
      profile: { ...profile, xpIntoLevel: 50, xpForNextLevel: 0 },
      today,
      newItems: noNew,
      isStaff: false,
    });
    const level = view.fields.find((f) => f.name === "hub.field.level");
    expect(level?.value).toContain("0%");
  });
});