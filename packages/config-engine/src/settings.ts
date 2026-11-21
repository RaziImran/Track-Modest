import { z } from "zod";

// ───────────────────────────── Types ─────────────────────────────

export const SizeTierSchema = z.enum(["TINY", "SMALL", "MEDIUM", "LARGE", "MASSIVE"]);
export const StrictnessSchema = z.enum(["RELAXED", "BALANCED", "STRICT", "LOCKDOWN"]);
export const CaseTypeSchema = z.enum([
  "WARN", "TIMEOUT", "UNTIMEOUT", "KICK", "BAN", "UNBAN", "SOFTBAN", "TEMPBAN",
  "NOTE_ONLY", "PURGE", "LOCK", "UNLOCK",
]);
export const ReportStatusSchema = z.enum(["OPEN", "CLAIMED", "RESOLVED_ACTION", "RESOLVED_NO_ACTION"]);
export const AppealStatusSchema = z.enum(["PENDING", "APPROVED", "DENIED"]);
export const LinkModeSchema = z.enum(["allow", "allowlist", "block"]);
export const InviteModeSchema = z.enum(["allow", "block"]);
export const BadwordsLevelSchema = z.enum(["slurs", "standard", "extended"]);
export const AutomodActionSchema = z.enum(["alert", "delete_warn", "delete_timeout"]);
export const RaidActionSchema = z.enum(["alert", "lock_and_alert", "lock_kick_new"]);
export const VerifyModeSchema = z.enum(["off", "new_accounts", "everyone", "everyone_captcha"]);
export const VerbositySchema = z.enum(["all", "important"]);

export type SizeTier = z.infer<typeof SizeTierSchema>;
export type Strictness = z.infer<typeof StrictnessSchema>;
export type CaseType = z.infer<typeof CaseTypeSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type AppealStatus = z.infer<typeof AppealStatusSchema>;
export type LinkMode = z.infer<typeof LinkModeSchema>;
export type InviteMode = z.infer<typeof InviteModeSchema>;
export type BadwordsLevel = z.infer<typeof BadwordsLevelSchema>;
export type AutomodAction = z.infer<typeof AutomodActionSchema>;
export type RaidAction = z.infer<typeof RaidActionSchema>;
export type VerifyMode = z.infer<typeof VerifyModeSchema>;
export type Verbosity = z.infer<typeof VerbositySchema>;

// ───────────────────────────── Setting key union ─────────────────────────────

export type SettingKey =
  | "automod.spam.maxMessages"
  | "automod.spam.windowSec"
  | "automod.duplicate.maxRepeats"
  | "automod.mentions.maxPerMessage"
  | "automod.mentions.maxRolePerMessage"
  | "automod.emoji.maxPerMessage"
  | "automod.caps.maxPercent"
  | "automod.newlines.max"
  | "automod.links.mode"
  | "automod.invites.mode"
  | "automod.phishing.enabled"
  | "automod.badwords.level"
  | "automod.zalgo.enabled"
  | "automod.ai.enabled"
  | "automod.media.nsfwScan"
  | "automod.firstAction"
  | "automod.timeoutSec"
  | "raid.joinMultiplier"
  | "raid.minJoins"
  | "raid.windowSec"
  | "raid.action"
  | "verify.mode"
  | "verify.minAccountAgeDays"
  | "warn.pointExpiryDays"
  | "antinuke.threshold"
  | "logging.verbosity"
  | "reports.autoEscalate";

export type SettingValue =
  | number
  | LinkMode
  | InviteMode
  | BadwordsLevel
  | AutomodAction
  | RaidAction
  | VerifyMode
  | Verbosity
  | boolean
  | "off";

export const AllowedSettingValues: Record<string, unknown[]> = {
  "automod.spam.maxMessages": [10, 7, 5, 4],
  "automod.spam.windowSec": [5],
  "automod.duplicate.maxRepeats": [5, 3, 2],
  "automod.mentions.maxPerMessage": [10, 6, 4, 3],
  "automod.mentions.maxRolePerMessage": [3, 2, 1],
  "automod.emoji.maxPerMessage": [30, 15, 10, 8],
  "automod.caps.maxPercent": ["off", 80, 70, 60],
  "automod.newlines.max": [30, 15, 10, 8],
  "automod.links.mode": ["allow", "allowlist", "block"],
  "automod.invites.mode": ["allow", "block"],
  "automod.phishing.enabled": [true],
  "automod.badwords.level": ["slurs", "standard", "extended"],
  "automod.zalgo.enabled": [true],
  "automod.ai.enabled": [true],
  "automod.media.nsfwScan": [true],
  "automod.firstAction": ["alert", "delete_warn", "delete_timeout"],
  "automod.timeoutSec": [300, 600, 1800, 3600],
  "raid.joinMultiplier": [15, 10, 6, 3],
  "raid.minJoins": [8, 10, 8, 5],
  "raid.windowSec": [60, 30, 30, 60],
  "raid.action": ["alert", "lock_and_alert", "lock_kick_new"],
  "verify.mode": ["off", "new_accounts", "everyone", "everyone_captcha"],
  "verify.minAccountAgeDays": [0, 3, 7, 14],
  "warn.pointExpiryDays": [14, 30, 60, 90],
  "antinuke.threshold": [5, 4, 3, 2],
  "logging.verbosity": ["all", "important"],
  "reports.autoEscalate": [true],
};

export type StrictnessIndex = 0 | 1 | 2 | 3;
export const STRICTNESS_ORDER: readonly Strictness[] = ["RELAXED", "BALANCED", "STRICT", "LOCKDOWN"];
export function strictnessIndex(s: Strictness): StrictnessIndex {
  const i = STRICTNESS_ORDER.indexOf(s);
  return (i >= 0 ? i : 1) as StrictnessIndex;
}
export function indexToStrictness(i: number): Strictness {
  return STRICTNESS_ORDER[Math.max(0, Math.min(3, i))]!;
}

// ───────────────────────────── Base table (§8.4) ─────────────────────────────

const RELAXED = "RELAXED" as const;
const BALANCED = "BALANCED" as const;
const STRICT = "STRICT" as const;
const LOCKDOWN = "LOCKDOWN" as const;

export const BASE_TABLE: Record<string, Record<Strictness, SettingValue>> = {
  "automod.spam.maxMessages": { [RELAXED]: 10, [BALANCED]: 7, [STRICT]: 5, [LOCKDOWN]: 4 },
  "automod.spam.windowSec": { [RELAXED]: 5, [BALANCED]: 5, [STRICT]: 5, [LOCKDOWN]: 5 },
  "automod.duplicate.maxRepeats": { [RELAXED]: 5, [BALANCED]: 3, [STRICT]: 2, [LOCKDOWN]: 2 },
  "automod.mentions.maxPerMessage": { [RELAXED]: 10, [BALANCED]: 6, [STRICT]: 4, [LOCKDOWN]: 3 },
  "automod.mentions.maxRolePerMessage": { [RELAXED]: 3, [BALANCED]: 2, [STRICT]: 1, [LOCKDOWN]: 1 },
  "automod.emoji.maxPerMessage": { [RELAXED]: 30, [BALANCED]: 15, [STRICT]: 10, [LOCKDOWN]: 8 },
  "automod.caps.maxPercent": { [RELAXED]: "off", [BALANCED]: 80, [STRICT]: 70, [LOCKDOWN]: 60 },
  "automod.newlines.max": { [RELAXED]: 30, [BALANCED]: 15, [STRICT]: 10, [LOCKDOWN]: 8 },
  "automod.links.mode": { [RELAXED]: "allow", [BALANCED]: "allow", [STRICT]: "allowlist", [LOCKDOWN]: "block" },
  "automod.invites.mode": { [RELAXED]: "allow", [BALANCED]: "block", [STRICT]: "block", [LOCKDOWN]: "block" },
  "automod.phishing.enabled": { [RELAXED]: true, [BALANCED]: true, [STRICT]: true, [LOCKDOWN]: true },
  "automod.badwords.level": { [RELAXED]: "slurs", [BALANCED]: "standard", [STRICT]: "extended", [LOCKDOWN]: "extended" },
  "automod.zalgo.enabled": { [RELAXED]: false, [BALANCED]: true, [STRICT]: true, [LOCKDOWN]: true },
  "automod.ai.enabled": { [RELAXED]: false, [BALANCED]: false, [STRICT]: true, [LOCKDOWN]: true },
  "automod.media.nsfwScan": { [RELAXED]: false, [BALANCED]: false, [STRICT]: true, [LOCKDOWN]: true },
  "automod.firstAction": { [RELAXED]: "alert", [BALANCED]: "delete_warn", [STRICT]: "delete_timeout", [LOCKDOWN]: "delete_timeout" },
  "automod.timeoutSec": { [RELAXED]: 300, [BALANCED]: 600, [STRICT]: 1800, [LOCKDOWN]: 3600 },
  "raid.joinMultiplier": { [RELAXED]: 15, [BALANCED]: 10, [STRICT]: 6, [LOCKDOWN]: 3 },
  "raid.minJoins": { [RELAXED]: 8, [BALANCED]: 10, [STRICT]: 8, [LOCKDOWN]: 5 },
  "raid.windowSec": { [RELAXED]: 60, [BALANCED]: 30, [STRICT]: 30, [LOCKDOWN]: 60 },
  "raid.action": { [RELAXED]: "alert", [BALANCED]: "lock_and_alert", [STRICT]: "lock_and_alert", [LOCKDOWN]: "lock_kick_new" },
  "verify.mode": { [RELAXED]: "off", [BALANCED]: "new_accounts", [STRICT]: "everyone", [LOCKDOWN]: "everyone_captcha" },
  "verify.minAccountAgeDays": { [RELAXED]: 0, [BALANCED]: 3, [STRICT]: 7, [LOCKDOWN]: 14 },
  "warn.pointExpiryDays": { [RELAXED]: 14, [BALANCED]: 30, [STRICT]: 60, [LOCKDOWN]: 90 },
  "antinuke.threshold": { [RELAXED]: 5, [BALANCED]: 4, [STRICT]: 3, [LOCKDOWN]: 2 },
  "logging.verbosity": { [RELAXED]: "all", [BALANCED]: "all", [STRICT]: "all", [LOCKDOWN]: "all" },
  "reports.autoEscalate": { [RELAXED]: false, [BALANCED]: false, [STRICT]: true, [LOCKDOWN]: true },
};

// ───────────────────────────── Size scaling (§8.5) ─────────────────────────────

const TIER_ORDER: readonly SizeTier[] = ["TINY", "SMALL", "MEDIUM", "LARGE", "MASSIVE"];
export function tierIndex(t: SizeTier): number {
  return TIER_ORDER.indexOf(t);
}

const ACTION_STEPS: readonly AutomodAction[] = ["alert", "delete_warn", "delete_timeout"];
const VERIFY_STEPS: readonly VerifyMode[] = ["off", "new_accounts", "everyone", "everyone_captcha"];

function shiftAction(a: AutomodAction, dir: 1 | -1): AutomodAction {
  const i = ACTION_STEPS.indexOf(a as AutomodAction);
  const ni = Math.max(0, Math.min(ACTION_STEPS.length - 1, i + dir));
  return ACTION_STEPS[ni]!;
}

function shiftVerify(v: VerifyMode, dir: 1 | -1): VerifyMode {
  const i = VERIFY_STEPS.indexOf(v as VerifyMode);
  const ni = Math.max(0, Math.min(VERIFY_STEPS.length - 1, i + dir));
  return VERIFY_STEPS[ni]!;
}

export interface SizeAdjustment {
  setting: string;
  value: SettingValue;
  reason: string;
}

export function applySizeScaling(setting: string, value: SettingValue, tier: SizeTier): SizeAdjustment {
  const ti = tierIndex(tier);
  let adj: SettingValue = value;
  let reason = "";

  switch (setting) {
    case "automod.spam.maxMessages": {
      const v = typeof value === "number" ? value : 7;
      let adjNum = v;
      if (ti === 0) adjNum += 2;
      if (ti === 1) adjNum += 1;
      if (ti === 4) adjNum -= 1;
      adjNum = Math.max(1, Math.round(adjNum));
      adj = adjNum;
      reason = "Small servers chat in bursts among friends; huge servers attract spam bots";
      break;
    }
    case "automod.firstAction": {
      if (typeof value === "string") {
        const dir = ti === 0 ? -1 : ti === 4 ? 1 : 0;
        if (dir !== 0) {
          adj = shiftAction(value as AutomodAction, dir);
          reason = ti === 0 ? "Small servers prefer mods handle it" : "Massive servers need automation";
        }
      }
      break;
    }
    case "raid.minJoins": {
      const v = typeof value === "number" ? value : 10;
      const mult = ti === 0 ? 0.6 : ti === 1 ? 1 : ti === 2 ? 1.5 : ti === 3 ? 3 : 6;
      adj = Math.max(1, Math.round(v * mult));
      reason = "Absolute joins scale with size";
      break;
    }
    case "verify.mode": {
      if (typeof value === "string") {
        const dir = ti === 0 ? -1 : 0;
        if (dir !== 0) {
          adj = shiftVerify(value as VerifyMode, dir);
          reason = "Tiny servers rarely need a gate";
        }
      }
      break;
    }
    case "logging.verbosity": {
      if (ti >= 3) {
        adj = "important";
        reason = "Large servers produce too many logs";
      }
      break;
    }
    case "reports.autoEscalate": {
      if (ti >= 2) {
        adj = true;
        reason = "Reports with 3+ reporters jump to top";
      }
      break;
    }
  }

  return { setting, value: adj, reason };
}

// ───────────────────────────── Adaptive size suggestions (§8.8) ─────────────────────────────

/** Minimum consecutive days in a new tier before a size suggestion is offered (§8.8). */
export const SIZE_SUGGESTION_MIN_DAYS = 7;

/**
 * Classify a raw member count into a {@link SizeTier} using the §8.2 boundaries:
 * TINY < 50, SMALL 50–499, MEDIUM 500–4,999, LARGE 5,000–49,999, MASSIVE >= 50,000.
 */
export function sizeTierFromMemberCount(count: number): SizeTier {
  if (count < 50) return "TINY";
  if (count < 500) return "SMALL";
  if (count < 5_000) return "MEDIUM";
  if (count < 50_000) return "LARGE";
  return "MASSIVE";
}

/** Outcome of {@link evaluateSizeSuggestion}. Pure — no I/O, no mutation. */
export interface SizeSuggestion {
  /** The tier implied by the guild's current member count. */
  currentTier: SizeTier;
  /** The tier currently stored in GuildConfig. */
  storedTier: SizeTier;
  /** True only when every gate in §8.8 passes and the owner should be prompted. */
  shouldSuggest: boolean;
}

/**
 * Decide whether to surface an adaptive size suggestion (§8.8).
 *
 * A suggestion is produced only when ALL of the following hold:
 *  1. the member-count tier differs from the stored tier,
 *  2. the stored tier is not locked (`sizeTierLocked === false`),
 *  3. the member count has stayed in the new tier for at least 7 consecutive days.
 *
 * This function never mutates config — the owner must explicitly act on a suggestion.
 */
export function evaluateSizeSuggestion(
  memberCount: number,
  storedTier: SizeTier,
  sizeTierLocked: boolean,
  daysInNewTier: number,
): SizeSuggestion {
  const currentTier = sizeTierFromMemberCount(memberCount);
  const shouldSuggest =
    currentTier !== storedTier &&
    !sizeTierLocked &&
    daysInNewTier >= SIZE_SUGGESTION_MIN_DAYS;
  return { currentTier, storedTier, shouldSuggest };
}

// ───────────────────────────── Resolution context ─────────────────────────────

export interface ResolveContext {
  guildId: string;
  channelId?: string;
  memberRep?: number;
  memberAccountAgeDays?: number;
}

export interface ChannelOverride {
  strictness?: Strictness;
  exempt?: string[];
  settings?: Record<string, unknown>;
}

export interface GuildConfigResolved {
  guildId: string;
  sizeTier: SizeTier;
  sizeTierLocked: boolean;
  strictness: Strictness;
  modules: Record<string, boolean>;
  overrides: Record<string, unknown>;
  channelOverrides: Record<string, ChannelOverride>;
  staffRoles: Record<string, string[]>;
  logChannels: Record<string, string>;
  modLogChannelId?: string;
  temporaryBoost?: { strictness: Strictness; startedBy: string; endsAt: string } | null;
}

// ───────────────────────────── Resolver (§8.3, §8.6) ─────────────────────────────

export function computeTrustShift(memberRep?: number): number {
  if (memberRep === undefined) return 0;
  if (memberRep < -100) return -1;
  if (memberRep > 100) return 1;
  return 0;
}

export function computeEffectiveStrictness(
  cfg: GuildConfigResolved,
  ctx: ResolveContext,
): Strictness {
  // Temporary boost only applies if stricter than current
  let guildStrictness = cfg.strictness;
  if (cfg.temporaryBoost) {
    const bi = strictnessIndex(cfg.temporaryBoost.strictness);
    const gi = strictnessIndex(guildStrictness);
    if (bi > gi) guildStrictness = cfg.temporaryBoost.strictness;
  }

  // Channel override strictness
  let channelStrictness = guildStrictness;
  if (ctx.channelId) {
    const ch = cfg.channelOverrides[ctx.channelId];
    if (ch && ch.strictness) {
      channelStrictness = ch.strictness!;
    }
  }

  // Member trust shift (§8.3): never below RELAXED, max STRICT unless guild is LOCKDOWN
  const shift = computeTrustShift(ctx.memberRep);
  let effective = strictnessIndex(channelStrictness) + shift;
  if (effective < 0) effective = 0;
  const guildIsLockdown = guildStrictness === LOCKDOWN;
  const maxAllowed = guildIsLockdown ? 3 : 2;
  if (effective > maxAllowed) effective = maxAllowed;
  return indexToStrictness(effective);
}

export function resolveSetting<K extends SettingKey>(
  cfg: GuildConfigResolved,
  key: K,
  ctx: ResolveContext,
): SettingValue {
  // 1. Base table from strictness
  const effectiveStrictness = computeEffectiveStrictness(cfg, ctx);
  let value: SettingValue | undefined = BASE_TABLE[key]?.[effectiveStrictness];

  // 2. Size scaling
  if (value !== undefined) {
    const sized = applySizeScaling(key, value, cfg.sizeTier);
    value = sized.value;
  }

  // 3. Guild custom overrides (absolute — not scaled, not shifted)
  if (cfg.overrides && key in cfg.overrides) {
    value = cfg.overrides[key] as SettingValue;
  }

  // 4. Channel-specific overrides
  if (ctx.channelId) {
    const ch = cfg.channelOverrides[ctx.channelId];
    if (ch && ch.settings && key in ch.settings) {
      value = ch.settings[key] as SettingValue;
    }
  }

  return value ?? BASE_TABLE[key]![BALANCED];
}

export function resolveAll(cfg: GuildConfigResolved, ctx: ResolveContext): Record<string, SettingValue> {
  const result: Record<string, SettingValue> = {};
  const keys: SettingKey[] = Object.keys(BASE_TABLE) as SettingKey[];
  for (const key of keys) {
    result[key] = resolveSetting(cfg, key, ctx);
  }
  return result;
}

export function describeProfile(size: SizeTier, strictness: Strictness, _locale: string): string[] {
  void _locale;
  const lines: string[] = [];
  lines.push(`Size: ${size}`);
  lines.push(`Strictness: ${strictness}`);

  const spam = BASE_TABLE["automod.spam.maxMessages"]![strictness];
  const spamAdj = applySizeScaling("automod.spam.maxMessages", spam, size);
  lines.push(
    `AutoMod spam: max ${spamAdj.value} messages per ${BASE_TABLE["automod.spam.windowSec"]![strictness]}s`,
  );

  lines.push(
    `Mentions: max ${BASE_TABLE["automod.mentions.maxPerMessage"]![strictness]} per message`,
  );

  const action = BASE_TABLE["automod.firstAction"]![strictness];
  const actionAdj = applySizeScaling("automod.firstAction", action, size);
  lines.push(`First action: ${actionAdj.value}`);

  const minJoins = BASE_TABLE["raid.minJoins"]![strictness];
  const joinAdj = applySizeScaling("raid.minJoins", minJoins, size);
  lines.push(`Raid: trigger if ${joinAdj.value}+ joins in ${BASE_TABLE["raid.windowSec"]![strictness]}s`);

  const verify = BASE_TABLE["verify.mode"]![strictness];
  const verifyAdj = applySizeScaling("verify.mode", verify, size);
  lines.push(`Verification: ${verifyAdj.value}`);

  const verb = BASE_TABLE["logging.verbosity"]![strictness];
  const verbAdj = applySizeScaling("logging.verbosity", verb, size);
  lines.push(`Logging verbosity: ${verbAdj.value}`);

  return lines;
}

// ───────────────────────────── Zod override validation ─────────────────────────────

export const OverrideSchema = z.object({
  path: z.string(),
  value: z.unknown(),
});

export function validateOverride(key: string, value: unknown):
  | { success: true; value: SettingValue }
  | { success: false; errors: string[] } {
  const allowed = AllowedSettingValues[key];
  if (!allowed) {
    return { success: false, errors: [`Unknown setting key: ${key}`] };
  }
  if (!allowed.includes(value)) {
    return {
      success: false,
      errors: [`Invalid value for ${key}: ${JSON.stringify(value)}. Allowed: ${JSON.stringify(allowed)}`],
    };
  }
  return { success: true, value: value as SettingValue };
}
