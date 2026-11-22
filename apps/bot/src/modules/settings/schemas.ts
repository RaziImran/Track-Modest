import { z } from "zod";

export const SettingsCategorySchema = z.enum([
  "General",
  "Protection",
  "AutoMod",
  "Logging",
  "Welcome",
  "Roles",
  "Reputation",
  "XP",
  "Nova",
  "Economy & Games",
  "Tickets",
  "Advanced",
]);

export type SettingsCategory = z.infer<typeof SettingsCategorySchema>;

export const SettingChangeSchema = z.object({
  path: z.string(),
  value: z.unknown(),
});

export type SettingChange = z.infer<typeof SettingChangeSchema>;

// Category → setting key mapping (§9.5)
export const CATEGORY_SETTINGS: Record<SettingsCategory, string[]> = {
  General: ["sizeTier", "strictness"],
  Protection: ["antinuke.threshold", "antinuke.trustedUsers", "verify.mode", "verify.minAccountAgeDays", "verify.kickAfterMinutes", "raid.windowSec", "raid.minJoins", "raid.joinMultiplier", "raid.action", "raid.pingMods", "compromised.enabled", "compromised.threshold", "compromised.timeoutMinutes", "risk.enabled"],
  AutoMod: [
    "automod.spam.maxMessages",
    "automod.spam.windowSec",
    "automod.duplicate.maxRepeats",
    "automod.mentions.maxPerMessage",
    "automod.mentions.maxRolePerMessage",
    "automod.emoji.maxPerMessage",
    "automod.caps.maxPercent",
    "automod.newlines.max",
    "automod.links.mode",
    "automod.invites.mode",
    "automod.phishing.enabled",
    "automod.badwords.level",
    "automod.zalgo.enabled",
    "automod.ai.enabled",
    "automod.media.nsfwScan",
    "automod.firstAction",
    "automod.timeoutSec",
    "shadow.mode",
  ],
  Logging: ["logging.verbosity", "modQueueChannelId"],
  Welcome: [],
  Roles: [],
  Reputation: ["warn.pointExpiryDays", "warn.ladder"],
  XP: [],
  Nova: [],
  "Economy & Games": [],
  Tickets: [],
  Advanced: [],
};

// Module toggle settings per category
export const CATEGORY_MODULES: Record<SettingsCategory, string[]> = {
  General: [],
  Protection: [],
  AutoMod: ["automod"],
  Logging: ["logging"],
  Welcome: ["welcome"],
  Roles: [],
  Reputation: ["rep"],
  XP: ["xp"],
  Nova: ["nova"],
  "Economy & Games": ["economy", "games"],
  Tickets: ["tickets"],
  Advanced: [],
};

// Display labels for settings
export const SETTING_LABELS: Record<string, string> = {
  sizeTier: "Server size tier",
  strictness: "Strictness level",
  "antinuke.threshold": "Anti-nuke threshold",
  "antinuke.trustedUsers": "Anti-nuke trusted users",
  "compromised.enabled": "Compromised account detection",
  "compromised.threshold": "Compromised link channel threshold",
  "compromised.timeoutMinutes": "Compromised timeout (minutes)",
  "risk.enabled": "Risk score computation",
  "verify.mode": "Verification mode",
  "verify.minAccountAgeDays": "Min account age (days)",
  "verify.kickAfterMinutes": "Kick unverified after (minutes)",
  "raid.windowSec": "Raid detection window (seconds)",
  "raid.minJoins": "Raid minimum joins threshold",
  "raid.joinMultiplier": "Raid join multiplier (vs baseline)",
  "raid.action": "Raid response action",
  "raid.pingMods": "Ping moderators on raid alert",
  "logging.verbosity": "Logging verbosity",
  "modQueueChannelId": "Mod review queue channel",
  "warn.pointExpiryDays": "Warning point expiry (days)",
  "warn.ladder": "Escalation ladder",
  "automod.spam.maxMessages": "AutoMod spam max messages",
  "automod.spam.windowSec": "AutoMod spam window (sec)",
  "automod.duplicate.maxRepeats": "AutoMod duplicate max repeats",
  "automod.mentions.maxPerMessage": "AutoMod mentions per message",
  "automod.mentions.maxRolePerMessage": "AutoMod max roles per message",
  "automod.emoji.maxPerMessage": "AutoMod emoji per message",
  "automod.caps.maxPercent": "AutoMod caps percent",
  "automod.newlines.max": "AutoMod newlines max",
  "automod.links.mode": "AutoMod links mode",
  "automod.invites.mode": "AutoMod invites mode",
  "automod.phishing.enabled": "AutoMod phishing scan",
  "automod.badwords.level": "AutoMod badwords level",
  "automod.zalgo.enabled": "AutoMod zalgo scan",
  "automod.ai.enabled": "AutoMod AI review",
  "automod.media.nsfwScan": "AutoMod media NSFW scan",
  "automod.firstAction": "AutoMod first action",
  "automod.timeoutSec": "AutoMod timeout (sec)",
  "shadow.mode": "Shadow mode duration (days)",
};

export const MODULE_LABELS: Record<string, string> = {
  automod: "AutoMod",
  antiraid: "Anti-raid",
  logging: "Logging",
  welcome: "Welcome",
  rep: "Reputation",
  xp: "XP & Levels",
  tickets: "Tickets",
  nova: "Nova (AI)",
  economy: "Economy",
  games: "Games",
};

export const CATEGORY_LABELS: Record<SettingsCategory, string> = {
  General: "General",
  Protection: "Protection",
  AutoMod: "AutoMod",
  Logging: "Logging",
  Welcome: "Welcome",
  Roles: "Staff Roles",
  Reputation: "Reputation",
  XP: "XP & Levels",
  Nova: "Nova (AI)",
  "Economy & Games": "Economy & Games",
  Tickets: "Tickets",
  Advanced: "Advanced",
};
