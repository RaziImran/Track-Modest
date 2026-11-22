// §8.10 Temporary boost — pure service layer (no discord.js imports).
import type { Strictness } from "@modest/config-engine";

export interface TemporaryBoostServiceDeps {
  createTemporaryBoost: (input: {
    guildId: string;
    strictness: Strictness;
    reason: string;
    startedBy: string;
    endsAt: Date;
  }) => Promise<{ id: number; guildId: string; strictness: Strictness; reason: string; startedBy: string; endsAt: Date; createdAt: Date }>;
  getActiveTemporaryBoost: (guildId: string) => Promise<{
    id: number; guildId: string; strictness: Strictness; reason: string; startedBy: string; endsAt: Date; createdAt: Date;
  } | null>;
  endTemporaryBoost: (guildId: string) => Promise<boolean>;
  scheduleBoostEndJob: (guildId: string, strictness: Strictness, endsAt: Date) => Promise<string>;
  cancelBoostEndJob: (guildId: string) => Promise<void>;
}

export interface BoostResult {
  endsAt: Date;
  durationSec: number;
}

export class TemporaryBoostService {
  public deps: TemporaryBoostServiceDeps;

  constructor(deps: TemporaryBoostServiceDeps) {
    this.deps = deps;
  }

  /** Apply a temporary strictness boost. Returns the endsAt and duration in seconds. */
  async applyBoost(input: {
    guildId: string;
    strictness: Strictness;
    reason: string;
    startedBy: string;
    durationSec: number;
  }): Promise<BoostResult> {
    const now = new Date();
    const endsAt = new Date(now.getTime() + input.durationSec * 1000);

    await this.deps.createTemporaryBoost({
      guildId: input.guildId,
      strictness: input.strictness,
      reason: input.reason,
      startedBy: input.startedBy,
      endsAt,
    });

    await this.deps.scheduleBoostEndJob(input.guildId, input.strictness, endsAt);

    return { endsAt, durationSec: input.durationSec };
  }

  /** End a temporary boost early. Returns true if a boost was ended. */
  async endBoost(guildId: string): Promise<boolean> {
    const active = await this.deps.getActiveTemporaryBoost(guildId);
    if (!active) return false;

    await this.deps.cancelBoostEndJob(guildId);
    return await this.deps.endTemporaryBoost(guildId);
  }

  /** Get the currently active boost for a guild, if any. */
  async getActiveBoost(guildId: string) {
    return this.deps.getActiveTemporaryBoost(guildId);
  }

  /** Parse a human duration string into seconds. Supports combined units, e.g. "90m", "2h30m". */
  static parseDuration(input: string): number {
    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    const clean = input.trim().toLowerCase().replace(/\s+/g, "");
    if (clean.length === 0) {
      throw new Error(`Invalid duration: "${input}"`);
    }
    const tokenRe = /(\d+)(s|m|h|d)/g;
    let total = 0;
    let consumed = "";
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(clean)) !== null) {
      const value = Number.parseInt(match[1] ?? "0", 10);
      const unit = match[2] ?? "";
      total += value * (units[unit] ?? 0);
      consumed += match[0];
    }
    if (consumed.length === 0 || consumed !== clean) {
      throw new Error(`Invalid duration: "${input}"`);
    }
    return total;
  }

  /** Validate duration is within 15 minutes to 24 hours. */
  static validateDurationSec(durationSec: number): { ok: true; durationSec: number } | { ok: false; error: string } {
    const MIN_DURATION_SEC = 15 * 60;      // 15 minutes
    const MAX_DURATION_SEC = 24 * 60 * 60; // 24 hours
    if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
      return { ok: false, error: "Duration must be between 15 minutes and 24 hours." };
    }
    return { ok: true, durationSec };
  }
}
