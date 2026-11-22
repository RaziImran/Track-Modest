// §11 AutoMod — pure service layer (no discord.js imports).
// Pipeline: checks 1–10 run in order; the first check that fires determines the action.
import type { AutomodHitRow, AutomodRuleRow } from "./repository.js";
import type {
  AutomodAction,
  AutomodRuleTrigger,
  BadWordsLevel,
  AutomodLinkMode,
  AutomodInviteMode,
} from "./schemas.js";

// ───────────────────────────── Types ─────────────────────────────

export interface AutomodConfig {
  firstAction: AutomodAction;
  timeoutSec: number;
  spamMaxMessages: number;
  spamWindowSec: number;
  duplicateMaxRepeats: number;
  mentionsMaxPerMessage: number;
  mentionsMaxRolePerMessage: number;
  emojiMaxPerMessage: number;
  capsMaxPercent: number;
  newlinesMax: number;
  zalgoEnabled: boolean;
  badWordsLevel: BadWordsLevel;
  linksMode: AutomodLinkMode;
  invitesMode: AutomodInviteMode;
  phishingEnabled: boolean;
  publicNotice: boolean;
  useNative: boolean;
  aiEnabled: boolean;
  mediaScanEnabled: boolean;
}

export interface AutomodMessageInput {
  guildId: string;
  userId: string;
  channelId: string;
  memberId: string;
  authorId: string;
  content: string;
  memberRoles: string[]; // role IDs of the author
  isBot: boolean;
  isStaff: boolean; // resolved staff level > "none"
  embedUrls: string[]; // URLs from message embeds
  attachmentCount: number;
  attachments: Array<{ filename: string; size: number; contentType?: string }>;
  mentionedUserIds: string[];
  mentionedRoleIds: string[];
  mentionEveryone: boolean;
  mentionHere: boolean;
  messageId: string;
  timestamp: Date;
  channelIsNsfw: boolean; // whether the channel is NSFW (for media scan gating)
  replyChainPriorHits: boolean; // whether this is a reply to a message with prior automod hits
}

export interface CheckResult {
  fired: boolean;
  ruleKey: string;
  action: AutomodAction | "none";
  reason: string; // i18n key
  details?: Record<string, unknown>;
}

export interface AutomodResponse {
  action: AutomodAction | "none";
  ruleKey: string;
  reason: string;
  details?: Record<string, unknown>;
  shouldDelete: boolean;
  shouldDm: boolean;
  shouldLog: boolean;
  shouldCreateCase: boolean;
  shadow: boolean;
  /** Post this hit to the Mod Review Queue (AM-12/AM-13). */
  shouldPostToReviewQueue: boolean;
  /** Review item type when shouldPostToReviewQueue is true. */
  reviewType?: "automod_ai" | "automod_media";
  /** Evidence to attach to the review item. */
  reviewEvidence?: unknown;
/** AI explanation text for automod_ai items. */
reviewAiExplanation?: string | null;
}

export interface SimulatedHit {
  messageId: string;
  userId: string;
  channelId: string;
  ruleKey: string;
  action: AutomodAction | "none";
  reason: string;
  wouldDelete: boolean;
}

export interface SimulationResult {
  totalMessages: number;
  wouldActionCount: number;
  wouldDeleteCount: number;
  affectedUsers: Set<string>;
  hits: SimulatedHit[];
  byRuleKey: Record<string, number>;
}

// Severity ladder for repeat escalation (low → high)
const ESCALATION_LADDER: AutomodAction[] = [
  "alert",
  "delete",
  "timeout",
  "kick",
  "ban",
];

function escalateAction(action: AutomodAction): AutomodAction {
  const idx = ESCALATION_LADDER.indexOf(action);
  const next = ESCALATION_LADDER[idx + 1];
  return next === undefined ? action : next;
}

// ───────────────────────────── Helpers ─────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[0]/g, "o")
    .replace(/[1]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[@]/g, "a")
    .replace(/\$/g, "s")
    .replace(/[!]/g, "i")
    .replace(/([a-z])\1{2,}/g, "$1$1") // collapse 3+ repeats to 2
    .replace(/[^\w\s]/g, " ") // remove separators/punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function buildBadWordRegex(words: string[]): RegExp {
  if (words.length === 0) return /(?!)/; // never matches
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "i");
}

function countZalgo(text: string): { baseChars: number; combiningMarks: number } {
  let baseChars = 0;
  let combiningMarks = 0;
  for (const ch of text) {
    // Combining mark range (Mn) approx U+0300–U+036F
    if (ch >= "\u0300" && ch <= "\u036f") {
      combiningMarks += 1;
    } else {
      baseChars += 1;
    }
  }
  return { baseChars, combiningMarks };
}

// ───────────────────────────── Checks ─────────────────────────────

export interface AutomodServiceDeps {
  getAutomodRules: (guildId: string) => Promise<AutomodRuleRow[]>;
  recordAutomodHit: (input: {
    guildId: string;
    userId: string;
    channelId: string;
    ruleKey: string;
    action: string;
    shadow: boolean;
  }) => Promise<AutomodHitRow>;
  getRepeatHitCount: (guildId: string, userId: string, windowSec: number) => Promise<number>;
  checkRateLimit: (guildId: string, userId: string, maxMessages: number, windowSec: number) => Promise<{
    allowed: boolean;
    remaining: number;
  }>;
  recordMessageHash: (guildId: string, userId: string, messageHash: string, windowSec: number, maxRepeats: number) => Promise<{
    isDuplicate: boolean;
    count: number;
  }>;
  recordCrossChannelHash: (guildId: string, messageHash: string, channelId: string, windowSec: number) => Promise<number>;
  incrementRepeatHits: (guildId: string, userId: string, windowSec: number) => Promise<number>;
  getRepeatHits: (guildId: string, userId: string) => Promise<number>;
  isPhishDomain: (domain: string) => Promise<boolean>;
  /** AI context review classifier (AM-12). Returns null when budget exhausted or AI unavailable. */
  aiClassify?: (input: {
    content: string;
    riskSignals: string[];
  }) => Promise<{ category: string; severity: number; explanation: string } | null>;
  /** Media scan classifier (AM-13). */
  mediaClassify?: (input: {
    attachments: Array<{ filename: string; size: number; contentType?: string }>;
    channelIsNsfw: boolean;
  }) => Promise<Array<{ category: "nsfw" | "gore" | "scam_qr" | "none"; confidence: number }>>;
}

export class AutomodService {
  public deps: AutomodServiceDeps;
  public config: AutomodConfig;

  constructor(deps: AutomodServiceDeps, config: AutomodConfig) {
    this.deps = deps;
    this.config = config;
  }

  // ───────────────────────────── Public entry ─────────────────────────────

  async handleMessage(input: AutomodMessageInput): Promise<AutomodResponse> {
    // Check 1: Exemptions
    if (await this.checkExemptions(input)) {
      return this.noneResponse();
    }

    // Check 2: Phishing/scam links (always actioned regardless of profile)
    if (this.config.phishingEnabled) {
      const phishHit = await this.checkPhishing(input);
      if (phishHit.fired) {
        const action = this.config.useNative ? "ban" : "delete_timeout";
        return this.hitResponse("automod:phishing", action, phishHit.reason, phishHit.details, true);
      }
    }

    // Check 3: Invite links
    if (this.config.invitesMode === "block") {
      const inviteHit = this.checkInvites(input);
      if (inviteHit.fired) {
        return this.hitResponse("automod:invite", this.config.firstAction, inviteHit.reason, inviteHit.details);
      }
    }

    // Check 4: Link policy
    const linkHit = this.checkLinkPolicy(input);
    if (linkHit.fired) {
      return this.hitResponse("automod:links", this.config.firstAction, linkHit.reason, linkHit.details);
    }

    // Check 5: Mention spam
    const mentionHit = this.checkMentions(input);
    if (mentionHit.fired) {
      return this.hitResponse("automod:mentions", this.config.firstAction, mentionHit.reason, mentionHit.details);
    }

    // Check 6: Message rate
    const rateHit = await this.checkRate(input);
    if (rateHit.fired) {
      return this.hitResponse("automod:rate", this.config.firstAction, rateHit.reason, rateHit.details);
    }

    // Check 7: Duplicate messages
    const dupHit = await this.checkDuplicates(input);
    if (dupHit.fired) {
      return this.hitResponse("automod:duplicate", this.config.firstAction, dupHit.reason, dupHit.details);
    }

    // Check 8: Bad words
    const badWordHit = this.checkBadWords(input);
    if (badWordHit.fired) {
      return this.hitResponse("automod:badwords", this.config.firstAction, badWordHit.reason, badWordHit.details);
    }

    // Check 9: Caps / emoji / newlines / zalgo
    const capsHit = this.checkCapsEmojiNewlinesZalgo(input);
    if (capsHit.fired) {
      return this.hitResponse("automod:caps_emoji_newlines_zalgo", this.config.firstAction, capsHit.reason, capsHit.details);
    }

    // Check 10: Custom rules
    const customHit = await this.checkCustomRules(input);
    if (customHit.fired) {
      return this.hitResponse(customHit.ruleKey, customHit.action, customHit.reason, customHit.details, customHit.shadow);
    }

    // Check 11: AI context review (AM-12)
    if (this.config.aiEnabled) {
      const aiHit = await this.checkAIContextReview(input);
      if (aiHit.fired) {
        return aiHit.response;
      }
    }

    // Check 12: Media scan (AM-13)
    if (this.config.mediaScanEnabled) {
      const mediaHit = await this.checkMediaScan(input);
      if (mediaHit.fired) {
        return mediaHit.response;
      }
    }

    return this.noneResponse();
  }

  // ───────────────────────────── Simulation (§14.7 Rule simulator) ─────────────────────────────

  /** Run the AutoMod pipeline against a list of messages without taking action (§14.7). */
  async simulatePipeline(
    messages: Array<{
      messageId: string;
      userId: string;
      channelId: string;
      content: string;
      attachments: Array<{ filename: string; size: number; contentType?: string }>;
      channelIsNsfw: boolean;
      isBot: boolean;
      isStaff: boolean;
      memberRoles: string[];
      embedUrls: string[];
      mentionUserIds: string[];
      mentionRoleIds: string[];
      mentionEveryone: boolean;
      mentionHere: boolean;
      timestamp: Date;
      replyChainPriorHits: boolean;
    }>,
    guildId: string,
  ): Promise<SimulationResult> {
    const hits: SimulatedHit[] = [];
    const affectedUsers = new Set<string>();
    const byRuleKey: Record<string, number> = {};

    for (const msg of messages) {
      if (msg.isBot || msg.isStaff) continue;

      const input: AutomodMessageInput = {
        guildId,
        userId: msg.userId,
        channelId: msg.channelId,
        memberId: msg.userId,
        authorId: msg.userId,
        content: msg.content,
        memberRoles: msg.memberRoles,
        isBot: msg.isBot,
        isStaff: msg.isStaff,
        embedUrls: msg.embedUrls,
        attachmentCount: msg.attachments.length,
        attachments: msg.attachments,
        mentionedUserIds: msg.mentionUserIds,
        mentionedRoleIds: msg.mentionRoleIds,
        mentionEveryone: msg.mentionEveryone,
        mentionHere: msg.mentionHere,
        messageId: msg.messageId,
        timestamp: msg.timestamp,
        channelIsNsfw: msg.channelIsNsfw,
        replyChainPriorHits: msg.replyChainPriorHits,
      };

      const response = await this.handleMessage(input);
      if (response.action !== "none" || response.shouldPostToReviewQueue) {
        hits.push({
          messageId: msg.messageId,
          userId: msg.userId,
          channelId: msg.channelId,
          ruleKey: response.ruleKey,
          action: response.action,
          reason: response.reason,
          wouldDelete: response.shouldDelete,
        });
        affectedUsers.add(msg.userId);
        byRuleKey[response.ruleKey] = (byRuleKey[response.ruleKey] ?? 0) + 1;
      }
    }

    return {
      totalMessages: messages.length,
      wouldActionCount: hits.length,
      wouldDeleteCount: hits.filter((h) => h.wouldDelete).length,
      affectedUsers,
      hits,
      byRuleKey,
    };
  }

  // ───────────────────────────── Check 1: Exemptions ─────────────────────────────

  async checkExemptions(input: AutomodMessageInput): Promise<boolean> {
    if (input.isBot) return true;
    if (input.isStaff) return true;
    // Exempt roles/channels come from AutomodRule rows; check each enabled rule
    const rules = await this.deps.getAutomodRules(input.guildId);
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.exemptRoles.length > 0 && rule.exemptRoles.some((r) => input.memberRoles.includes(r))) return true;
      if (rule.exemptChannels.includes(input.channelId)) return true;
    }
    return false;
  }

  // ───────────────────────────── Check 2: Phishing/scam links ─────────────────────────────

  async checkPhishing(input: AutomodMessageInput): Promise<CheckResult> {
    const urls = [...extractUrls(input.content), ...input.embedUrls];
    const lookalikeKeywords = ["discord.com", "discord.gg", "steamcommunity.com", "nitro"];
    for (const url of urls) {
      const domain = extractDomain(url);
      if (!domain) continue;
      const isLookalike = lookalikeKeywords.some((k) => domain.includes(k));
      const isPhish = await this.deps.isPhishDomain(domain);
      if (isPhish || (isLookalike && urls.some((u) => /nitro|gift|free/i.test(u)))) {
        return {
          fired: true,
          ruleKey: "automod:phishing",
          action: "delete",
          reason: "automod:check:phishing",
          details: { domain, url },
        };
      }
    }
    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 3: Invite links ─────────────────────────────

  checkInvites(input: AutomodMessageInput): CheckResult {
    const inviteRegex = /(discord\.gg|discord(app)?\.com\/invite)\/[\w-]+/g;
    let match;
    while ((match = inviteRegex.exec(input.content)) !== null) {
      const inviteCode = match[0].split("/").pop() ?? "";
      // Own-server invites are allowed — in the pure service we can't resolve the invite,
      // so the command/index layer must pass `ownServerInviteCodes` if this check is to be skipped.
      // Here we treat any invite as a hit when mode is block; the index layer can suppress known-own codes.
      return {
        fired: true,
        ruleKey: "automod:invite",
        action: "delete",
        reason: "automod:check:invite",
        details: { inviteCode },
      };
    }
    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 4: Link policy ─────────────────────────────

  checkLinkPolicy(input: AutomodMessageInput): CheckResult {
    const allowlist = [
      "youtube.com", "youtu.be", "twitch.tv", "x.com", "twitter.com",
      "reddit.com", "github.com", "wikipedia.org", "tenor.com", "giphy.com",
    ];
    const urls = [...extractUrls(input.content), ...input.embedUrls];
    for (const url of urls) {
      const domain = extractDomain(url);
      if (!domain) continue;
      if (this.config.linksMode === "allow") {
        // Only allowlist domains are allowed
        if (!allowlist.includes(domain)) {
          return { fired: true, ruleKey: "automod:links", action: "delete", reason: "automod:check:links", details: { domain, mode: "allow" } };
        }
      } else if (this.config.linksMode === "block") {
        // Block all links
        return { fired: true, ruleKey: "automod:links", action: "delete", reason: "automod:check:links", details: { domain, mode: "block" } };
      }
      // allowlist mode: allowlist domains pass, others are blocked unless in allowlist
      if (!allowlist.includes(domain)) {
        return { fired: true, ruleKey: "automod:links", action: "delete", reason: "automod:check:links", details: { domain, mode: "allowlist" } };
      }
    }
    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 5: Mention spam ─────────────────────────────

  checkMentions(input: AutomodMessageInput): CheckResult {
    let score = 0;
    score += input.mentionedUserIds.length;
    score += input.mentionedRoleIds.length;
    if (input.mentionEveryone) score += 5;
    if (input.mentionHere) score += 5;

    if (score > this.config.mentionsMaxPerMessage) {
      return {
        fired: true,
        ruleKey: "automod:mentions",
        action: "delete",
        reason: "automod:check:mentions",
        details: { score, max: this.config.mentionsMaxPerMessage },
      };
    }
    if (input.mentionedRoleIds.length > this.config.mentionsMaxRolePerMessage) {
      return {
        fired: true,
        ruleKey: "automod:mentions",
        action: "delete",
        reason: "automod:check:mentions_roles",
        details: { roleCount: input.mentionedRoleIds.length, max: this.config.mentionsMaxRolePerMessage },
      };
    }
    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 6: Message rate ─────────────────────────────

  async checkRate(input: AutomodMessageInput): Promise<CheckResult> {
    const result = await this.deps.checkRateLimit(
      input.guildId,
      input.userId,
      this.config.spamMaxMessages,
      this.config.spamWindowSec,
    );
    if (!result.allowed) {
      return {
        fired: true,
        ruleKey: "automod:rate",
        action: "delete",
        reason: "automod:check:rate",
        details: { max: this.config.spamMaxMessages, windowSec: this.config.spamWindowSec, remaining: result.remaining },
      };
    }
    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 7: Duplicate messages ─────────────────────────────

  async checkDuplicates(input: AutomodMessageInput): Promise<CheckResult> {
    const normalized = normalizeText(input.content);
    const hash = simpleHash(normalized);

    const dupResult = await this.deps.recordMessageHash(
      input.guildId,
      input.userId,
      hash,
      60, // windowSec: last 60 seconds
      this.config.duplicateMaxRepeats,
    );
    if (dupResult.isDuplicate) {
      return {
        fired: true,
        ruleKey: "automod:duplicate",
        action: "delete",
        reason: "automod:check:duplicate",
        details: { count: dupResult.count, max: this.config.duplicateMaxRepeats },
      };
    }

    // Cross-channel duplicate: same message in 3+ channels within 30 seconds
    const channelCount = await this.deps.recordCrossChannelHash(input.guildId, hash, input.channelId, 30);
    if (channelCount >= 3) {
      return {
        fired: true,
        ruleKey: "automod:duplicate_crosschannel",
        action: "delete",
        reason: "automod:check:duplicate_crosschannel",
        details: { channelCount },
      };
    }

    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 8: Bad words ─────────────────────────────

  checkBadWords(input: AutomodMessageInput): CheckResult {
    if (this.config.badWordsLevel === "off") return { fired: false, ruleKey: "", action: "none", reason: "" };

    const wordList = loadBadWordList(this.config.badWordsLevel);
    if (wordList.length === 0) return { fired: false, ruleKey: "", action: "none", reason: "" };

    const regex = buildBadWordRegex(wordList);
    const normalized = normalizeText(input.content);
    const match = normalized.match(regex);
    if (match) {
      return {
        fired: true,
        ruleKey: "automod:badwords",
        action: "delete",
        reason: "automod:check:badwords",
        details: { matchedWord: match[0] },
      };
    }
    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 9: Caps / emoji / newlines / zalgo ─────────────────────────────

  checkCapsEmojiNewlinesZalgo(input: AutomodMessageInput): CheckResult {
    const content = input.content;
    if (content.length === 0) return { fired: false, ruleKey: "", action: "none", reason: "" };

    // Caps percentage
    let upperCount = 0;
    let letterCount = 0;
    for (const ch of content) {
      if (/[a-zA-Z]/.test(ch)) {
        letterCount += 1;
        if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) upperCount += 1;
      }
    }
    const capsPercent = letterCount > 0 ? Math.round((upperCount / letterCount) * 100) : 0;
    if (capsPercent > this.config.capsMaxPercent) {
      return {
        fired: true,
        ruleKey: "automod:caps",
        action: "delete",
        reason: "automod:check:caps",
        details: { percent: capsPercent, max: this.config.capsMaxPercent },
      };
    }

    // Emoji count (Unicode emoji + custom <:name:id>)
    const customEmojiCount = (content.match(/<a?:[a-zA-Z0-9_]+:\d+>/g) ?? []).length;
    const unicodeEmojiCount = (content.match(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu) ?? []).length;
    const totalEmoji = customEmojiCount + unicodeEmojiCount;
    if (totalEmoji > this.config.emojiMaxPerMessage) {
      return {
        fired: true,
        ruleKey: "automod:emoji",
        action: "delete",
        reason: "automod:check:emoji",
        details: { count: totalEmoji, max: this.config.emojiMaxPerMessage },
      };
    }

    // Newlines
    const newlineCount = (content.match(/\n/g) ?? []).length;
    if (newlineCount > this.config.newlinesMax) {
      return {
        fired: true,
        ruleKey: "automod:newlines",
        action: "delete",
        reason: "automod:check:newlines",
        details: { count: newlineCount, max: this.config.newlinesMax },
      };
    }

    // Zalgo: > 3 combining marks per base char
    if (this.config.zalgoEnabled) {
      const { baseChars, combiningMarks } = countZalgo(content);
      if (baseChars > 0 && combiningMarks / baseChars > 3) {
        return {
          fired: true,
          ruleKey: "automod:zalgo",
          action: "delete",
          reason: "automod:check:zalgo",
          details: { baseChars, combiningMarks },
        };
      }
    }

    return { fired: false, ruleKey: "", action: "none", reason: "" };
  }

  // ───────────────────────────── Check 10: Custom rules ─────────────────────────────

  async checkCustomRules(input: AutomodMessageInput): Promise<CheckResult & { shadow: boolean }> {
    const rules = await this.deps.getAutomodRules(input.guildId);
    const normalized = normalizeText(input.content);

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const matched = this.matchRuleTrigger(rule.trigger, input, normalized);
      if (matched) {
        // Determine action: use rule's first action, or config firstAction
        const ruleAction = rule.actions[0]?.type;
        const action: AutomodAction = ruleAction === undefined ? this.config.firstAction : ruleAction;
        return {
          fired: true,
          ruleKey: `automod:rule:${rule.id}`,
          action,
          reason: `automod:check:custom:${rule.name}`,
          details: { ruleId: rule.id, ruleName: rule.name },
          shadow: rule.shadow,
        };
      }
    }
    return { fired: false, ruleKey: "", action: "none", reason: "", shadow: false };
  }

  // ───────────────────────────── Check 11: AI context review (AM-12) ─────────────────────────────

  /** Detect risk signals in message content that warrant AI review. */
  private detectRiskSignals(content: string): string[] {
    const signals: string[] = [];
    // Second-person insults: "you are X", "you suck"
    if (/\byou\s+(are\s+)?(stupid|idiot|dumb|moron|jerk|fool)\b|\byou\s+suck\b/i.test(content)) {
      signals.push("second_person_insult");
    }
    // Threat keywords
    if (/\b(kill|threaten|hurt|destroy|attack|beat.?up|harm)\b/i.test(content)) {
      signals.push("threat");
    }
    // Self-harm keywords
    if (/\b(suicide|self.?harm|kill myself|end it all|cut myself|want to die)\b/i.test(content)) {
      signals.push("self_harm");
    }
    return signals;
  }

  async checkAIContextReview(input: AutomodMessageInput): Promise<{
    fired: boolean;
    response: AutomodResponse;
  }> {
    if (!this.deps.aiClassify) {
      return { fired: false, response: this.noneResponse() };
    }

    const riskSignals = this.detectRiskSignals(input.content);
    if (riskSignals.length === 0 && !input.replyChainPriorHits) {
      return { fired: false, response: this.noneResponse() };
    }

    let classification;
    try {
      classification = await this.deps.aiClassify({
        content: input.content,
        riskSignals,
      });
    } catch {
      // AI call failed — skip silently, do not block the message
      return { fired: false, response: this.noneResponse() };
    }

    // Budget exhausted or AI unavailable — skip silently (§11.6)
    if (!classification) {
      return { fired: false, response: this.noneResponse() };
    }

    // Self-harm: notify mods with gentle-response template + crisis resources; never punish.
    if (classification.category === "self_harm") {
      return {
        fired: true,
        response: {
          action: "alert",
          ruleKey: "automod:ai_review",
          reason: "automod:check:ai_review",
          details: { category: classification.category, explanation: classification.explanation, riskSignals },
          shouldDelete: false,
          shouldDm: false,
          shouldLog: true,
          shouldCreateCase: false,
          shadow: false,
          shouldPostToReviewQueue: true,
          reviewType: "automod_ai",
          reviewEvidence: { category: classification.category, severity: classification.severity, riskSignals },
          reviewAiExplanation: classification.explanation,
        },
      };
    }

    // Severity >= 2 → post to Mod Review Queue with Delete/Warn/Timeout/Dismiss buttons.
    // Never auto-punish from AI.
    if (classification.severity >= 2) {
      return {
        fired: true,
        response: {
          action: "alert",
          ruleKey: "automod:ai_review",
          reason: "automod:check:ai_review",
          details: { category: classification.category, severity: classification.severity, explanation: classification.explanation, riskSignals },
          shouldDelete: false,
          shouldDm: false,
          shouldLog: true,
          shouldCreateCase: false,
          shadow: false,
          shouldPostToReviewQueue: true,
          reviewType: "automod_ai",
          reviewEvidence: { category: classification.category, severity: classification.severity, explanation: classification.explanation, riskSignals },
          reviewAiExplanation: classification.explanation,
        },
      };
    }

    return { fired: false, response: this.noneResponse() };
  }

  // ───────────────────────────── Check 12: Media scan (AM-13) ─────────────────────────────

  async checkMediaScan(input: AutomodMessageInput): Promise<{
    fired: boolean;
    response: AutomodResponse;
  }> {
    if (!this.deps.mediaClassify) {
      return { fired: false, response: this.noneResponse() };
    }

    const imageAttachments = input.attachments.filter(
      (a) => (a.contentType ?? "").startsWith("image/"),
    );
    if (imageAttachments.length === 0) {
      return { fired: false, response: this.noneResponse() };
    }

    // NSFW channels are excluded from media scan (§11.7)
    if (input.channelIsNsfw) {
      return { fired: false, response: this.noneResponse() };
    }

    let results;
    try {
      results = await this.deps.mediaClassify({
        attachments: imageAttachments,
        channelIsNsfw: input.channelIsNsfw,
      });
    } catch {
      // Vision call failed — skip silently
      return { fired: false, response: this.noneResponse() };
    }

    // Filter to actual hits (non-none categories)
    const hits = results.filter((r) => r.category !== "none");
    if (hits.length === 0) {
      return { fired: false, response: this.noneResponse() };
    }

    // Only scam_qr with high confidence auto-deletes (§11.7)
    const scamQrHighConfidence = hits.some((r) => r.category === "scam_qr" && r.confidence >= 0.8);

    return {
      fired: true,
      response: {
        action: scamQrHighConfidence ? "delete" : "alert",
        ruleKey: "automod:media_scan",
        reason: "automod:check:media_scan",
        details: { results: hits },
        shouldDelete: scamQrHighConfidence,
        shouldDm: scamQrHighConfidence,
        shouldLog: true,
        shouldCreateCase: false,
        shadow: false,
        shouldPostToReviewQueue: true,
        reviewType: "automod_media",
        reviewEvidence: { results: hits },
        reviewAiExplanation: null,
      },
    };
  }

  private matchRuleTrigger(
    trigger: AutomodRuleTrigger,
    input: AutomodMessageInput,
    normalized: string,
  ): boolean {
    switch (trigger.type) {
      case "keywords": {
        const words = trigger.config.words;
        const mode = trigger.config.matchMode;
        for (const word of words) {
          const w = word.toLowerCase();
          if (mode === "word") {
            if (normalized.split(/\s+/).includes(w)) return true;
          } else {
            if (normalized.includes(w)) return true;
          }
        }
        return false;
      }
      case "regex": {
        try {
          return new RegExp(trigger.config.pattern).test(input.content);
        } catch {
          return false;
        }
      }
      case "links": {
        const domains = [...extractUrls(input.content), ...input.embedUrls].map(extractDomain).filter(Boolean);
        return domains.some((d) => trigger.config.domains.includes(d ?? ""));
      }
      case "attachments": {
        const blockedExts = trigger.config.blockedExtensions ?? [];
        if (blockedExts.length > 0) {
          const hasBlocked = input.attachments.some((a) => {
            const ext = a.filename.split(".").pop() ?? "";
            return blockedExts.includes(ext.toLowerCase());
          });
          if (hasBlocked) return true;
        }
        if (trigger.config.maxSizeBytes && input.attachments.some((a) => a.size > trigger.config.maxSizeBytes!)) return true;
        if (trigger.config.maxCount && input.attachmentCount > trigger.config.maxCount) return true;
        return false;
      }
      case "newAccount": {
        // The index layer passes accountAgeDays via input; here we check if the input has it
        // For now, the service doesn't have account age; the index layer pre-filters.
        return false;
      }
    }
    return false;
  }

  // ───────────────────────────── Repeat escalation ─────────────────────────────

  /** Call after a hit fires to apply repeat escalation. Returns the possibly-escalated action and whether it escalated. */
  async applyEscalation(input: AutomodMessageInput, action: AutomodAction): Promise<{ action: AutomodAction; escalated: boolean }> {
    const count = await this.deps.incrementRepeatHits(input.guildId, input.userId, 600); // 10 min window
    if (count >= 3) {
      return { action: escalateAction(action), escalated: true };
    }
    return { action, escalated: false };
  }

  // ───────────────────────────── Response builders ─────────────────────────────

  private noneResponse(): AutomodResponse {
    return {
      action: "none",
      ruleKey: "",
      reason: "",
      shouldDelete: false,
      shouldDm: false,
      shouldLog: false,
      shouldCreateCase: false,
      shadow: false,
      shouldPostToReviewQueue: false,
    };
  }

  private hitResponse(
    ruleKey: string,
    action: AutomodAction | "none",
    reason: string,
    details?: Record<string, unknown>,
    shadow = false,
    shouldPostToReviewQueue = false,
    reviewType?: "automod_ai" | "automod_media",
    reviewEvidence?: unknown,
    reviewAiExplanation?: string | null,
  ): AutomodResponse {
    const effectiveAction = action === "none" ? "delete" : action;
    return {
      action: effectiveAction,
      ruleKey,
      reason,
      details,
      shouldDelete: effectiveAction === "delete" || effectiveAction === "delete_timeout",
      shouldDm: true,
      shouldLog: true,
      shouldCreateCase: effectiveAction === "warn" || effectiveAction === "timeout",
      shadow,
      shouldPostToReviewQueue,
      reviewType,
      reviewEvidence,
      reviewAiExplanation,
    };
  }
}

// ───────────────────────────── String helpers ─────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<]+/g;
  const matches: string[] = [];
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    matches.push(m[0]);
  }
  return matches;
}

function extractDomain(url: string): string | null {
  try {
    return new globalThis.URL(url).hostname;
  } catch {
    return null;
  }
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return String(hash);
}

// ───────────────────────────── Bad word lists ─────────────────────────────

import { readFileSync } from "node:fs";
import { join } from "node:path";

const WORDLIST_DIR = join(process.cwd(), "packages", "shared", "data", "wordlists", "en");

const FALLBACK_WORD_LISTS: Record<BadWordsLevel, string[]> = {
  off: [],
  standard: [
    // §11.3 — original placeholder word list (not copied from any commercial game)
    "examplebad", "testprofane", "sampleoffense", "dummycurse",
  ],
  extended: [
    "examplebad", "testprofane", "sampleoffense", "dummycurse",
    "mildinsult1", "mildinsult2", "softnegative",
  ],
};

function loadWordListFromFile(filename: string): string[] {
  try {
    const fullPath = join(WORDLIST_DIR, filename);
    const text = readFileSync(fullPath, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

const BAD_WORD_LISTS: Record<BadWordsLevel, string[]> = {
  off: [],
  standard: (() => {
    const fromFile = loadWordListFromFile("standard.txt");
    return fromFile.length > 0 ? fromFile : FALLBACK_WORD_LISTS.standard;
  })(),
  extended: (() => {
    const fromFile = loadWordListFromFile("extended.txt");
    return fromFile.length > 0 ? fromFile : FALLBACK_WORD_LISTS.extended;
  })(),
};

function loadBadWordList(level: BadWordsLevel): string[] {
  return BAD_WORD_LISTS[level];
}
