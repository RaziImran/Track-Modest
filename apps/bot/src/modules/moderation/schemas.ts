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
