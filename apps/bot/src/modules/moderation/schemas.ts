export interface WarnCommandInput {
  user: string;
  reason: string;
  points: number;
  silent: boolean;
}

export function validateWarnInput(raw: unknown): WarnCommandInput | { error: string } {
  const r = raw as Record<string, unknown>;
  if (typeof r["user"] !== "string" || !r["user"]) return { error: "User is required" };
  if (typeof r["reason"] !== "string" || !r["reason"]) return { error: "Reason is required" };
  if ((r["reason"] as string).length > 1000) return { error: "Reason too long" };
  const points = typeof r["points"] === "number" ? r["points"] : 1;
  if (!Number.isInteger(points) || points < 1 || points > 5) return { error: "Points must be 1-5" };
  const silent = typeof r["silent"] === "boolean" ? r["silent"] : false;
  return { user: r["user"] as string, reason: r["reason"] as string, points, silent };
}

export interface CaseViewInput {
  number: number;
}

export function validateCaseView(raw: unknown): CaseViewInput | { error: string } {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { error: "Invalid case number" };
  return { number: n };
}

export interface CaseUndoInput {
  number: number;
}

export function validateCaseUndo(raw: unknown): CaseUndoInput | { error: string } {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { error: "Invalid case number" };
  return { number: n };
}
