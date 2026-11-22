import type { HubNewItems, HubTabAction } from "./schemas.js";

export type { HubNewItems, HubTabAction };

export type HubButtonStyle = "primary" | "secondary" | "success";

export interface HubProfile {
  displayName: string;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  coins: number;
  rep: number;
  bond: number;
  streak: number;
  seasonTier: number;
  seasonTierMax: number;
}

export interface HubTodayStats {
  questsDone: number;
  questsTotal: number;
  dailyRewardReady: boolean;
}

export interface HubViewModelInput {
  profile: HubProfile;
  today: HubTodayStats;
  newItems: HubNewItems;
  isStaff: boolean;
  showProfileCard?: boolean;
  showTodayStats?: boolean;
}

export interface HubField {
  name: string;
  value: string;
  inline: boolean;
}

export interface HubButton {
  action: HubTabAction;
  customId: string;
  emoji: string;
  style: HubButtonStyle;
  labelKey: string;
  redDot: boolean;
}

export interface HubViewModel {
  titleKey: string;
  greeting: string;
  todayLine: string;
  color: "brand";
  fields: HubField[];
  buttons: HubButton[];
}

export interface HubActionDef {
  action: HubTabAction;
  emoji: string;
  style: HubButtonStyle;
  redDot: (_newItems: HubNewItems, _today: HubTodayStats) => boolean;
  staffOnly?: boolean;
}

export const RED_DOT = "\u{1F534}";

export const HUB_ACTION_DEFS: HubActionDef[] = [
  {
    action: "claimDaily",
    emoji: "\u{1F381}",
    style: "primary",
    redDot: (_newItems, today) => today.dailyRewardReady,
  },
  {
    action: "nova",
    emoji: "\u{1F4AC}",
    style: "secondary",
    redDot: (newItems) => newItems.novaMessage,
  },
  {
    action: "games",
    emoji: "\u{1F3AE}",
    style: "secondary",
    redDot: () => false,
  },
  {
    action: "quests",
    emoji: "\u{1F4CB}",
    style: "secondary",
    redDot: (newItems) => newItems.completedQuest,
  },
  {
    action: "leaderboards",
    emoji: "\u{1F3C6}",
    style: "secondary",
    redDot: () => false,
  },
  {
    action: "shop",
    emoji: "\u{1F6CD}\u{FE0F}",
    style: "secondary",
    redDot: () => false,
  },
  {
    action: "inventory",
    emoji: "\u{1F392}",
    style: "secondary",
    redDot: () => false,
  },
  {
    action: "badges",
    emoji: "\u{1F3C5}",
    style: "secondary",
    redDot: (newItems) => newItems.newBadge,
  },
  {
    action: "serverSettings",
    emoji: "\u{2699}\u{FE0F}",
    style: "secondary",
    redDot: () => false,
    staffOnly: true,
  },
];

export function computeRedDots(
  newItems: HubNewItems,
  today: HubTodayStats,
): Record<HubTabAction, boolean> {
  const redDots = {} as Record<HubTabAction, boolean>;
  for (const def of HUB_ACTION_DEFS) {
    redDots[def.action] = def.redDot(newItems, today);
  }
  return redDots;
}

export function buttonCustomId(action: string): string {
  return `hub:tab:${action}`;
}

export function resolveVisibleActions(isStaff: boolean): HubTabAction[] {
  return HUB_ACTION_DEFS.filter((def) => !def.staffOnly || isStaff).map((def) => def.action);
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function labelKeyFor(action: string): string {
  return `hub.tab.${action}`;
}

export function buildHubButtons(
  visibleActions: HubTabAction[],
  redDots: Record<HubTabAction, boolean>,
): HubButton[] {
  return visibleActions.map((action) => {
    const def = HUB_ACTION_DEFS.find((d) => d.action === action);
    return {
      action,
      customId: buttonCustomId(action),
      emoji: def?.emoji ?? "\u{2022}",
      style: def?.style ?? "secondary",
      labelKey: labelKeyFor(action),
      redDot: redDots[action] ?? false,
    };
  });
}

function formatXpBar(current: number, max: number): string {
  const width = 12;
  if (max <= 0) {
    return "\u{25B1}".repeat(width) + " 0%";
  }
  const clamped = Math.max(0, Math.min(current, max));
  const pct = clamped / max;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return "\u{25B0}".repeat(filled) + "\u{25B1}".repeat(empty) + ` ${Math.round(pct * 100)}%`;
}

function buildGreeting(name: string, streak: number): string {
  if (streak > 0) {
    return `Hi, ${name}! \u{1F525} ${streak}-day streak`;
  }
  return `Hi, ${name}!`;
}

function buildTodayLine(today: HubTodayStats): string {
  const parts: string[] = [];
  parts.push(`${today.questsDone}/${today.questsTotal} quests done`);
  if (today.dailyRewardReady) {
    parts.push("Daily reward ready!");
  }
  return parts.join(" \u{00B7} ");
}

export function buildHubView(input: HubViewModelInput): HubViewModel {
  const { profile, today, newItems, isStaff } = input;
  const showProfileCard = input.showProfileCard !== false;
  const showTodayStats = input.showTodayStats !== false;

  const fields: HubField[] = [];

  if (showProfileCard) {
    fields.push({
      name: "hub.field.level",
      value: `Level ${profile.level} \u{00B7} ${formatXpBar(profile.xpIntoLevel, profile.xpForNextLevel)}`,
      inline: false,
    });
    fields.push({
      name: "hub.field.wallet",
      value: `\u{1FA99} ${profile.coins} \u{00B7} \u{1F4A0} ${profile.rep} \u{00B7} \u{1F49C} ${profile.bond}`,
      inline: true,
    });
    fields.push({
      name: "hub.field.season",
      value: `${profile.seasonTier}/${profile.seasonTierMax}`,
      inline: true,
    });
  }

  if (showTodayStats) {
    const todayValue = buildTodayLine(today);
    fields.push({
      name: "hub.field.today",
      value: today.dailyRewardReady ? `${todayValue} \u{1F381}` : todayValue,
      inline: false,
    });
  }

  const redDots = computeRedDots(newItems, today);
  const visibleActions = resolveVisibleActions(isStaff);
  const buttons = buildHubButtons(visibleActions, redDots);

  return {
    titleKey: "hub.title",
    greeting: buildGreeting(profile.displayName, profile.streak),
    todayLine: buildTodayLine(today),
    color: "brand",
    fields,
    buttons,
  };
}