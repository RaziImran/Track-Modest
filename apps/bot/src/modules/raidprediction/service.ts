// §15.3 Raid prediction — pure service layer (no discord.js imports).
import { createHash } from "node:crypto";

export interface JoinRecord {
  userId: string;
  username: string;
  avatarHash: string | null;
  accountCreatedAt: Date;
  joinedAt: Date;
}

export interface RaidPredictionResult {
  predicted: boolean;
  reason: "coordinated_age" | "coordinated_name" | "coordinated_avatar" | null;
  joiners: JoinRecord[];
}

export interface RaidPredictionConfig {
  minJoins: number;
  timeWindowSec: number;
  accountAgeWindowSec: number;
  nameSimilarityThreshold: number;
}

const DEFAULT_CONFIG: RaidPredictionConfig = {
  minJoins: 3,
  timeWindowSec: 120, // 2 minutes
  accountAgeWindowSec: 1800, // 30 minutes
  nameSimilarityThreshold: 0.8,
};

export function parseConfig(overrides: Record<string, unknown> | undefined): RaidPredictionConfig {
  const get = (key: string, fallback: number): number => {
    const v = overrides?.[key];
    return typeof v === "number" ? v : fallback;
  };
  return {
    minJoins: get("raidPrediction.minJoins", DEFAULT_CONFIG.minJoins),
    timeWindowSec: get("raidPrediction.timeWindowSec", DEFAULT_CONFIG.timeWindowSec),
    accountAgeWindowSec: get("raidPrediction.accountAgeWindowSec", DEFAULT_CONFIG.accountAgeWindowSec),
    nameSimilarityThreshold: get("raidPrediction.nameSimilarityThreshold", DEFAULT_CONFIG.nameSimilarityThreshold) / 100,
  };
}

/** Normalized Levenshtein similarity between two strings (0-1). */
function normalizedLevenshtein(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  const m = la.length;
  const n = lb.length;
  if (m === 0) return n === 0 ? 1 : 0;
  if (n === 0) return 0;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion
        dp[i]![j - 1]! + 1, // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }
  const maxLen = Math.max(m, n);
  return maxLen === 0 ? 1 : 1 - dp[m]![n]! / maxLen;
}

/** Hash an avatar hash for comparison. */
function hashAvatar(avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  return createHash("sha256").update(avatarHash).digest("hex").substring(0, 16);
}

/** Detect coordinated joins among recent join records. */
export function detectCoordinatedJoins(
  joins: JoinRecord[],
  config: RaidPredictionConfig,
): RaidPredictionResult {
  if (joins.length < config.minJoins) {
    return { predicted: false, reason: null, joiners: [] };
  }

  const now = Date.now();
  const timeWindowMs = config.timeWindowSec * 1000;
  const accountAgeWindowMs = config.accountAgeWindowSec * 1000;

  // Filter to joins within the time window
  const recent = joins.filter((j) => now - j.joinedAt.getTime() <= timeWindowMs);
  if (recent.length < config.minJoins) {
    return { predicted: false, reason: null, joiners: [] };
  }

  // 1. Coordinated account age: ≥ minJoins accounts created within accountAgeWindowSec
  const byAge = [...recent].sort((a, b) => a.accountCreatedAt.getTime() - b.accountCreatedAt.getTime());
  const minJoins = config.minJoins;
  for (let i = 0; i <= byAge.length - minJoins; i++) {
    const window = byAge.slice(i, i + minJoins);
    const last = window[minJoins - 1]!;
    const first = window[0]!;
    const span = last.accountCreatedAt.getTime() - first.accountCreatedAt.getTime();
    if (span <= accountAgeWindowMs) {
      return { predicted: true, reason: "coordinated_age", joiners: window };
    }
  }

  // 2. Coordinated usernames: ≥ minJoins with similar names (Levenshtein ≥ threshold)
  for (let i = 0; i < recent.length; i++) {
    const first = recent[i]!;
    const similar: JoinRecord[] = [first];
    for (let j = i + 1; j < recent.length; j++) {
      const other = recent[j]!;
      if (normalizedLevenshtein(first.username, other.username) >= config.nameSimilarityThreshold) {
        similar.push(other);
      }
    }
    if (similar.length >= minJoins) {
      return { predicted: true, reason: "coordinated_name", joiners: similar };
    }
  }

  // 3. Coordinated avatars: ≥ minJoins with identical avatar hash
  const avatarGroups = new Map<string, JoinRecord[]>();
  for (const j of recent) {
    const h = hashAvatar(j.avatarHash);
    if (!h) continue;
    if (!avatarGroups.has(h)) avatarGroups.set(h, []);
    avatarGroups.get(h)!.push(j);
  }
  for (const [, group] of avatarGroups) {
    if (group.length >= minJoins) {
      return { predicted: true, reason: "coordinated_avatar", joiners: group };
    }
  }

  return { predicted: false, reason: null, joiners: [] };
}
