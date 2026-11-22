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
