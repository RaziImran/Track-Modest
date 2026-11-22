import { z } from "zod";

export const HubTabActionSchema = z.enum([
  "claimDaily",
  "nova",
  "games",
  "quests",
  "leaderboards",
  "shop",
  "inventory",
  "badges",
  "serverSettings",
]);

export type HubTabAction = z.infer<typeof HubTabActionSchema>;

export const HubProfileSchema = z.object({
  displayName: z.string().min(1).max(200),
  level: z.number().int().min(0),
  xpIntoLevel: z.number().int().min(0),
  xpForNextLevel: z.number().int().min(1),
  coins: z.number().int().min(0),
  rep: z.number().int(),
  bond: z.number().int().min(0),
  streak: z.number().int().min(0),
  seasonTier: z.number().int().min(0),
  seasonTierMax: z.number().int().min(1),
});

export type HubProfile = z.infer<typeof HubProfileSchema>;

export const HubTodayStatsSchema = z.object({
  questsDone: z.number().int().min(0),
  questsTotal: z.number().int().min(0),
  dailyRewardReady: z.boolean(),
});

export type HubTodayStats = z.infer<typeof HubTodayStatsSchema>;

export const HubNewItemsSchema = z.object({
  dailyReward: z.boolean().default(false),
  completedQuest: z.boolean().default(false),
  newBadge: z.boolean().default(false),
  novaMessage: z.boolean().default(false),
});

export type HubNewItems = z.infer<typeof HubNewItemsSchema>;

export const HubRenderInputSchema = z.object({
  profile: HubProfileSchema,
  today: HubTodayStatsSchema,
  newItems: HubNewItemsSchema.default({}),
  isStaff: z.boolean().default(false),
  showProfileCard: z.boolean().default(true),
  showTodayStats: z.boolean().default(true),
});

export type HubRenderInput = z.infer<typeof HubRenderInputSchema>;

export function validateHubRenderInput(raw: unknown): HubRenderInput | { error: string } {
  const parsed = HubRenderInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid hub input" };
  }
  return parsed.data;
}

export const HubStartHereSchema = z.object({
  enabled: z.boolean().default(false),
  channelId: z.string().min(1).max(32).optional(),
});

export type HubStartHere = z.infer<typeof HubStartHereSchema>;

export const HubConfigSchema = z.object({
  showProfileCard: z.boolean().default(true),
  showTodayStats: z.boolean().default(true),
  showServerSettingsForStaff: z.boolean().default(true),
  startHere: HubStartHereSchema.default({ enabled: false }),
});

export type HubConfig = z.infer<typeof HubConfigSchema>;

export function parseHubConfig(raw: unknown): HubConfig {
  const source =
    raw && typeof raw === "object" && "hub" in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>)["hub"]
      : raw;
  return HubConfigSchema.parse(source ?? {});
}