import { z } from "zod";

export const SetupPresetSchema = z.enum([
  "Gaming",
  "Study",
  "Creator",
  "Friends",
  "Large public",
  "Custom",
]);

export type SetupPreset = z.infer<typeof SetupPresetSchema>;

export const SetupSizeTierSchema = z.enum([
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "MASSIVE",
]);

export type SetupSizeTier = z.infer<typeof SetupSizeTierSchema>;

export const SetupStrictnessSchema = z.enum([
  "RELAXED",
  "BALANCED",
  "STRICT",
  "LOCKDOWN",
]);

export type SetupStrictness = z.infer<typeof SetupStrictnessSchema>;

// Setup wizard state — stored in Redis with TTL
export const SetupStateSchema = z.object({
  step: z.number().min(1).max(8),
  locale: z.string().optional(),
  preset: SetupPresetSchema.optional(),
  sizeTier: SetupSizeTierSchema.optional(),
  strictness: SetupStrictnessSchema.optional(),
  staffRoles: z
    .object({
      admin: z.array(z.string()).default([]),
      moderator: z.array(z.string()).default([]),
      helper: z.array(z.string()).default([]),
    })
    .default({ admin: [], moderator: [], helper: [] }),
  channels: z
    .object({
      modLogChannelId: z.string().optional(),
      welcomeChannelId: z.string().optional(),
    })
    .default({}),
  modules: z.record(z.boolean()).default({}),
});

export type SetupState = z.infer<typeof SetupStateSchema>;

// Initial state
export function initialSetupState(): SetupState {
  return {
    step: 1,
    staffRoles: { admin: [], moderator: [], helper: [] },
    channels: {},
    modules: {},
  };
}

// Preset definitions (§9.4)
export interface PresetDefinition {
  strictness: SetupStrictness;
  modules: Record<string, boolean>;
  extra?: string;
}

export const PRESETS: Record<SetupPreset, PresetDefinition> = {
  Gaming: {
    strictness: "BALANCED",
    modules: {
      automod: true,
      antiraid: true,
      logging: true,
      welcome: true,
      rep: true,
      xp: true,
      economy: true,
      games: true,
      nova: true,
    },
    extra: "Invite links blocked",
  },
  Study: {
    strictness: "BALANCED",
    modules: {
      automod: true,
      logging: true,
      welcome: true,
      rep: true,
      tickets: true,
      nova: true,
    },
    extra: "Links allowed; XP off",
  },
  Creator: {
    strictness: "BALANCED",
    modules: {
      automod: true,
      antiraid: true,
      logging: true,
      welcome: true,
      rep: true,
      xp: true,
      feeds: true,
      giveaways: true,
    },
    extra: "Self-promo channel exemption suggested",
  },
  Friends: {
    strictness: "RELAXED",
    modules: {
      logging: true,
      xp: true,
      economy: true,
      games: true,
      nova: true,
    },
    extra: "AutoMod minimal",
  },
  "Large public": {
    strictness: "STRICT",
    modules: {
      automod: true,
      antiraid: true,
      logging: true,
      verification: true,
      reports: true,
      tickets: true,
      rep: true,
    },
    extra: "AI review on if accepted",
  },
  Custom: {
    strictness: "BALANCED",
    modules: {},
    extra: undefined,
  },
};

// Supported locales (§31 — en only at launch, others planned)
export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt-BR",
  "fr",
  "de",
  "hi",
  "ur",
  "ar",
  "tr",
  "id",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Module categories for step 7 (§9.3)
export interface ModuleCategory {
  key: string;
  label: string;
  description: string;
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
  { key: "automod", label: "AutoMod", description: "Spam, scam, and harmful content detection" },
  { key: "antiraid", label: "Anti-raid", description: "Join-spike detection and raid actions" },
  { key: "logging", label: "Logging", description: "Message, member, and role audit logs" },
  { key: "welcome", label: "Welcome", description: "Welcome/goodbye messages and auto-roles" },
  { key: "rep", label: "Reputation", description: "Member reputation and trust scoring" },
  { key: "xp", label: "XP & Levels", description: "Chat and voice XP with level roles" },
  { key: "tickets", label: "Tickets", description: "Support ticket system" },
  { key: "nova", label: "Nova (AI)", description: "AI companion chat and tools" },
  { key: "economy", label: "Economy", description: "Wallets, shop, and payments" },
  { key: "games", label: "Games", description: "Server games and activities" },
];
