import { z } from "zod";

export const WarnCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
  points: z.number().int().min(1, "Points must be between 1 and 5").max(5, "Points must be between 1 and 5").default(1),
  silent: z.boolean().default(false),
});

export type WarnCommandInput = z.infer<typeof WarnCommandInputSchema>;

export function validateWarnInput(raw: unknown): WarnCommandInput | { error: string } {
  const parsed = WarnCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

// Discord's hard limit for a single timeout is 28 days (in seconds).
export const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;

const DurationStringSchema = z
  .string()
  .min(1, "Duration is required")
  .regex(/^\s*\d+\s*(s|m|h|d|w)(\s*\d+\s*(s|m|h|d|w))*\s*$/i, "Invalid duration (e.g. 5m, 2h30m, 1d, 28d)");

export const TimeoutCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  duration: DurationStringSchema,
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type TimeoutCommandInput = z.infer<typeof TimeoutCommandInputSchema>;

export function validateTimeoutInput(raw: unknown): TimeoutCommandInput | { error: string } {
  const parsed = TimeoutCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

export const UnTimeoutCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type UnTimeoutCommandInput = z.infer<typeof UnTimeoutCommandInputSchema>;

export function validateUnTimeoutInput(raw: unknown): UnTimeoutCommandInput | { error: string } {
  const parsed = UnTimeoutCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

export const KickCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type KickCommandInput = z.infer<typeof KickCommandInputSchema>;

export function validateKickInput(raw: unknown): KickCommandInput | { error: string } {
  const parsed = KickCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

export const BanDeleteMessagesSchema = z.enum(["none", "1h", "24h", "7d"]);

export const BanCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
  duration: z
    .string()
    .regex(/^\s*\d+\s*(s|m|h|d|w)(\s*\d+\s*(s|m|h|d|w))*\s*$/i, "Invalid duration (e.g. 5m, 2h30m, 1d, 7d, 2w)")
    .optional(),
  deleteMessages: BanDeleteMessagesSchema.optional().default("none"),
});

export type BanCommandInput = z.infer<typeof BanCommandInputSchema>;

export function validateBanInput(raw: unknown): BanCommandInput | { error: string } {
  const parsed = BanCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

export const SoftBanCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type SoftBanCommandInput = z.infer<typeof SoftBanCommandInputSchema>;

export function validateSoftBanInput(raw: unknown): SoftBanCommandInput | { error: string } {
  const parsed = SoftBanCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

export const UnBanCommandInputSchema = z.object({
  user: z.string().min(1, "User is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type UnBanCommandInput = z.infer<typeof UnBanCommandInputSchema>;

export function validateUnBanInput(raw: unknown): UnBanCommandInput | { error: string } {
  const parsed = UnBanCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}
export const CaseViewInputSchema = z.object({
  number: z.coerce.number().int().min(1, "Invalid case number"),
});

export type CaseViewInput = z.infer<typeof CaseViewInputSchema>;

export function validateCaseView(raw: unknown): CaseViewInput | { error: string } {
  const parsed = CaseViewInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid case number" };
  }
  return parsed.data;
}

export const CaseUndoInputSchema = z.object({
  number: z.coerce.number().int().min(1, "Invalid case number"),
});

export type CaseUndoInput = z.infer<typeof CaseUndoInputSchema>;

export function validateCaseUndo(raw: unknown): CaseUndoInput | { error: string } {
  const parsed = CaseUndoInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid case number" };
  }
  return parsed.data;
}

const MAX_MASSBAN_USERS = 200;

function parseUserIds(input: string): string[] {
  const mentions = input.match(/<@!?(\d+)>/g) ?? [];
  const idsFromMentions = mentions.map((m) => m.replace(/<@!?(\d+)>/, "$1"));
  const remaining = input.replace(/<@!?\d+>/g, "");
  const idsFromText = remaining
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^\d+$/.test(s));
  return [...new Set([...idsFromMentions, ...idsFromText])];
}

export const MassBanCommandInputSchema = z.object({
  users: z.string().min(1, "At least one user is required"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type MassBanCommandInput = z.infer<typeof MassBanCommandInputSchema>;

export function validateMassBanInput(raw: unknown): { userIds: string[]; reason: string } | { error: string } {
  const parsed = MassBanCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userIds = parseUserIds(parsed.data.users);
  if (userIds.length === 0) {
    return { error: "No valid user IDs found" };
  }
  if (userIds.length > MAX_MASSBAN_USERS) {
    return { error: `Cannot massban more than ${MAX_MASSBAN_USERS} users at once` };
  }
  return { userIds, reason: parsed.data.reason };
}

export const PurgeSubcommandSchema = z.enum(["any", "user", "bots", "links", "attachments", "contains", "regex"]);

export const PurgeCommandInputSchema = z.object({
  subcommand: PurgeSubcommandSchema,
  amount: z.coerce.number().int().min(1, "Amount must be between 1 and 1000").max(1000, "Amount must be between 1 and 1000").default(100),
  user: z.string().optional(),
  text: z.string().max(1000, "Text too long").optional(),
  pattern: z.string().max(1000, "Pattern too long").optional(),
});

export type PurgeCommandInput = z.infer<typeof PurgeCommandInputSchema>;

export function validatePurgeInput(raw: unknown): PurgeCommandInput | { error: string } {
  const parsed = PurgeCommandInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  if (data.subcommand === "user" && !data.user) {
    return { error: "User is required for the user subcommand" };
  }
  if (data.subcommand === "contains" && !data.text) {
    return { error: "Text is required for the contains subcommand" };
  }
  if (data.subcommand === "regex" && !data.pattern) {
    return { error: "Pattern is required for the regex subcommand" };
  }
  return data;
}

const MESSAGE_AGE_LIMIT_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function isMessageTooOld(timestamp: Date | string): boolean {
  const msgTime = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp.getTime();
  return Date.now() - msgTime > MESSAGE_AGE_LIMIT_MS;
}
