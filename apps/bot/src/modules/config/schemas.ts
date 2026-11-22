import { z } from "zod";

const DurationStringSchema = z
  .string()
  .min(1, "Duration is required")
  .regex(/^\s*\d+\s*(s|m|h|d)(\s*\d+\s*(s|m|h|d))*\s*$/i, "Invalid duration (e.g. 15m, 2h, 1d)");

export const StrictnessBoostInputSchema = z.object({
  level: z.enum(["STRICT", "LOCKDOWN"] as const),
  duration: DurationStringSchema,
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
});

export type StrictnessBoostInput = z.infer<typeof StrictnessBoostInputSchema>;

export function validateStrictnessBoostInput(
  raw: unknown,
): StrictnessBoostInput | { error: string } {
  const parsed = StrictnessBoostInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

export const StrictnessBoostEndInputSchema = z.object({});

export type StrictnessBoostEndInput = z.infer<typeof StrictnessBoostEndInputSchema>;

export function validateStrictnessBoostEndInput(
  raw: unknown,
): StrictnessBoostEndInput | { error: string } {
  const parsed = StrictnessBoostEndInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return parsed.data;
}

const MIN_DURATION_SEC = 15 * 60;      // 15 minutes
const MAX_DURATION_SEC = 24 * 60 * 60; // 24 hours

export function validateDurationRange(
  durationSec: number,
): { ok: true; durationSec: number } | { ok: false; error: string } {
  if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
    return { ok: false, error: "Duration must be between 15 minutes and 24 hours." };
  }
  return { ok: true, durationSec };
}
