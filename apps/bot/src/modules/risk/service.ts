// §15.1 Behaviour risk score — pure service layer (no discord.js imports).
import type { GuildMember } from "discord.js";

export type RiskLabel = "Low" | "Medium" | "High" | "Critical";

export interface RiskFactor {
  key: string;
  label: string;
  points: number;
}

export interface RiskScoreResult {
  score: number; // 0-100
  label: RiskLabel;
  factors: RiskFactor[]; // top 3 reasons
}

export interface RiskComputeDeps {
  getActiveWarnPoints: (guildId: string, userId: string) => Promise<number>;
  getOpenReportsCount: (guildId: string, userId: string) => Promise<number>;
  getMemberRep: (guildId: string, userId: string) => Promise<number>;
  getMemberJoinedAt: (guildId: string, userId: string) => Promise<Date | null>;
  isJoinedDuringRaid: (guildId: string, userId: string) => Promise<boolean>;
  getAutomodHitsLast7Days: (guildId: string, userId: string) => Promise<number>;
  isInSharedBanNetwork: (guildId: string, userId: string) => Promise<boolean>;
}

export interface RiskConfig {
  accountAge1Day: number;
  accountAge7Days: number;
  accountAge30Days: number;
  defaultAvatar: number;
  joinedDuringRaid: number;
  warnPointsMultiplier: number;
  warnPointsMax: number;
  automodHitsMultiplier: number;
  automodHitsMax: number;
  openReportsMultiplier: number;
  openReportsMax: number;
  repNegative: number;
  repTrustedBonus: number;
  cleanRecordBonusDays: number;
  cleanRecordBonusPoints: number;
  sharedBanNetwork: number;
}

const DEFAULT_CONFIG: RiskConfig = {
  accountAge1Day: 25,
  accountAge7Days: 15,
  accountAge30Days: 5,
  defaultAvatar: 5,
  joinedDuringRaid: 20,
  warnPointsMultiplier: 8,
  warnPointsMax: 30,
  automodHitsMultiplier: 4,
  automodHitsMax: 20,
  openReportsMultiplier: 10,
  openReportsMax: 20,
  repNegative: 10,
  repTrustedBonus: -30,
  cleanRecordBonusDays: 90,
  cleanRecordBonusPoints: -20,
  sharedBanNetwork: 40,
};

export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

export function scoreLabel(score: number): RiskLabel {
  if (score < 20) return "Low";
  if (score < 50) return "Medium";
  if (score < 75) return "High";
  return "Critical";
}

export function parseConfig(overrides: Record<string, unknown> | undefined): RiskConfig {
  const get = (key: string, fallback: number): number => {
    const v = overrides?.[key];
    return typeof v === "number" ? v : fallback;
  };
  return {
    accountAge1Day: get("risk.accountAge1Day", DEFAULT_CONFIG.accountAge1Day),
    accountAge7Days: get("risk.accountAge7Days", DEFAULT_CONFIG.accountAge7Days),
    accountAge30Days: get("risk.accountAge30Days", DEFAULT_CONFIG.accountAge30Days),
    defaultAvatar: get("risk.defaultAvatar", DEFAULT_CONFIG.defaultAvatar),
    joinedDuringRaid: get("risk.joinedDuringRaid", DEFAULT_CONFIG.joinedDuringRaid),
    warnPointsMultiplier: get("risk.warnPointsMultiplier", DEFAULT_CONFIG.warnPointsMultiplier),
    warnPointsMax: get("risk.warnPointsMax", DEFAULT_CONFIG.warnPointsMax),
    automodHitsMultiplier: get("risk.automodHitsMultiplier", DEFAULT_CONFIG.automodHitsMultiplier),
    automodHitsMax: get("risk.automodHitsMax", DEFAULT_CONFIG.automodHitsMax),
    openReportsMultiplier: get("risk.openReportsMultiplier", DEFAULT_CONFIG.openReportsMultiplier),
    openReportsMax: get("risk.openReportsMax", DEFAULT_CONFIG.openReportsMax),
    repNegative: get("risk.repNegative", DEFAULT_CONFIG.repNegative),
    repTrustedBonus: get("risk.repTrustedBonus", DEFAULT_CONFIG.repTrustedBonus),
    cleanRecordBonusDays: get("risk.cleanRecordBonusDays", DEFAULT_CONFIG.cleanRecordBonusDays),
    cleanRecordBonusPoints: get("risk.cleanRecordBonusPoints", DEFAULT_CONFIG.cleanRecordBonusPoints),
    sharedBanNetwork: get("risk.sharedBanNetwork", DEFAULT_CONFIG.sharedBanNetwork),
  };
}

export async function computeRiskScore(
  member: GuildMember,
  guildId: string,
  deps: RiskComputeDeps,
  config: RiskConfig,
): Promise<RiskScoreResult> {
  const now = Date.now();
  const factors: RiskFactor[] = [];
  let score = 0;

  // 1. Account age
  const accountAgeDays = (now - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
  let agePoints = 0;
  if (accountAgeDays < 1) {
    agePoints = config.accountAge1Day;
    factors.push({ key: "accountAge1Day", label: "Account created less than 1 day ago", points: agePoints });
  } else if (accountAgeDays < 7) {
    agePoints = config.accountAge7Days;
    factors.push({ key: "accountAge7Days", label: "Account created less than 7 days ago", points: agePoints });
  } else if (accountAgeDays < 30) {
    agePoints = config.accountAge30Days;
    factors.push({ key: "accountAge30Days", label: "Account created less than 30 days ago", points: agePoints });
  }
  score += agePoints;

  // 2. Default avatar
  if (member.user.defaultAvatarURL !== null && !member.user.avatar) {
    score += config.defaultAvatar;
    factors.push({ key: "defaultAvatar", label: "Using default avatar", points: config.defaultAvatar });
  }

  // 3. Joined during raid
  const duringRaid = await deps.isJoinedDuringRaid(guildId, member.id);
  if (duringRaid) {
    score += config.joinedDuringRaid;
    factors.push({ key: "joinedDuringRaid", label: "Joined during a detected raid", points: config.joinedDuringRaid });
  }

  // 4. Active warn points
  const warnPoints = await deps.getActiveWarnPoints(guildId, member.id);
  const warnPointsPoints = Math.min(warnPoints * config.warnPointsMultiplier, config.warnPointsMax);
  if (warnPointsPoints > 0) {
    score += warnPointsPoints;
    factors.push({ key: "warnPoints", label: `Active warning points (${warnPoints}) × ${config.warnPointsMultiplier}`, points: warnPointsPoints });
  }

  // 5. Automod hits in last 7 days
  const automodHits = await deps.getAutomodHitsLast7Days(guildId, member.id);
  const automodPoints = Math.min(automodHits * config.automodHitsMultiplier, config.automodHitsMax);
  if (automodPoints > 0) {
    score += automodPoints;
    factors.push({ key: "automodHits", label: `AutoMod hits in last 7 days (${automodHits}) × ${config.automodHitsMultiplier}`, points: automodPoints });
  }

  // 6. Open reports against user
  const openReports = await deps.getOpenReportsCount(guildId, member.id);
  const reportPoints = Math.min(openReports * config.openReportsMultiplier, config.openReportsMax);
  if (reportPoints > 0) {
    score += reportPoints;
    factors.push({ key: "openReports", label: `Open reports against user (${openReports}) × ${config.openReportsMultiplier}`, points: reportPoints });
  }

  // 7. Rep < 0
  const rep = await deps.getMemberRep(guildId, member.id);
  if (rep < 0) {
    score += config.repNegative;
    factors.push({ key: "repNegative", label: `Negative reputation (${rep})`, points: config.repNegative });
  }

  // 8. Rep ≥ 2000 (Trusted) — bonus (negative points)
  if (rep >= 2000) {
    score += config.repTrustedBonus;
    factors.push({ key: "repTrusted", label: `Trusted reputation (${rep})`, points: config.repTrustedBonus });
  }

  // 9. Member for > 90 days with clean record
  const joinedAt = await deps.getMemberJoinedAt(guildId, member.id);
  if (joinedAt && (now - joinedAt.getTime()) / (1000 * 60 * 60 * 24) >= config.cleanRecordBonusDays) {
    // Clean record = no warn points, no automod hits, no open reports
    if (warnPoints === 0 && automodHits === 0 && openReports === 0) {
      score += config.cleanRecordBonusPoints;
      factors.push({ key: "cleanRecord", label: `Member for ${config.cleanRecordBonusDays}+ days with clean record`, points: config.cleanRecordBonusPoints });
    }
  }

  // 10. Listed in shared ban network
  const inBanNetwork = await deps.isInSharedBanNetwork(guildId, member.id);
  if (inBanNetwork) {
    score += config.sharedBanNetwork;
    factors.push({ key: "sharedBanNetwork", label: "Listed in shared ban network", points: config.sharedBanNetwork });
  }

  score = clampScore(score);

  // Sort factors by points descending, take top 3
  factors.sort((a, b) => b.points - a.points);
  const topFactors = factors.slice(0, 3);

  return { score, label: scoreLabel(score), factors: topFactors };
}
