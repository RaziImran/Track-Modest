// §12.2 Verification gate — pure service layer (no discord.js runtime imports).
import type { GuildMember } from "discord.js";
import { createHash } from "node:crypto";

export type VerifyMode = "off" | "new_accounts" | "everyone" | "everyone_captcha";

export interface VerifyConfig {
  mode: VerifyMode;
  minAccountAgeDays: number;
  kickAfterMinutes: number | null;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface VerificationStateRow {
  guildId: string;
  userId: string;
  method: "button" | "captcha" | "quiz";
  attempts: number;
  captchaAnswer: string | null;
  passedAt: Date | null;
  createdAt: Date;
}

export interface VerificationServiceDeps {
  getVerificationState: (guildId: string, userId: string) => Promise<VerificationStateRow | null>;
  setVerificationState: (input: {
    guildId: string;
    userId: string;
    method: "button" | "captcha" | "quiz";
    attempts: number;
    captchaAnswer: string | null;
    passedAt: Date | null;
  }) => Promise<void>;
  clearVerificationState: (guildId: string, userId: string) => Promise<void>;
}

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CAPTCHA_LENGTH = 6;
const CAPTCHA_EXPIRY_MIN = 5;

export class VerificationService {
  public deps: VerificationServiceDeps;

  constructor(deps: VerificationServiceDeps) {
    this.deps = deps;
  }

  /** Parse verify config from guild config overrides. */
  static parseConfig(overrides: Record<string, unknown> | undefined): VerifyConfig {
    const mode = (overrides?.["verify.mode"] as VerifyMode | undefined) ?? "off";
    const minAccountAgeDays =
      typeof overrides?.["verify.minAccountAgeDays"] === "number"
        ? (overrides["verify.minAccountAgeDays"] as number)
        : 7;
    const kickAfterMinutes =
      typeof overrides?.["verify.kickAfterMinutes"] === "number"
        ? (overrides["verify.kickAfterMinutes"] as number)
        : 30;
    return { mode, minAccountAgeDays, kickAfterMinutes };
  }

  /** Determine whether a joining member needs verification. */
  static shouldVerify(member: GuildMember, config: VerifyConfig): boolean {
    if (config.mode === "off") return false;
    if (config.mode === "everyone" || config.mode === "everyone_captcha") return true;
    if (config.mode === "new_accounts") {
      const ageDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
      return ageDays < config.minAccountAgeDays;
    }
    return false;
  }

  /** Generate a random 6-character captcha code (no 0/O/1/I confusion). */
  static generateCaptchaCode(): string {
    let code = "";
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
      code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    }
    return code;
  }

  /** SHA-256 hash of a captcha code. */
  static hashCaptchaCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /** Check if a captcha code matches the stored hash. */
  static verifyCaptcha(code: string, hash: string): boolean {
    return VerificationService.hashCaptchaCode(code) === hash;
  }

  /** Check quiz answers against questions. Returns number correct and whether all passed. */
  static checkQuizAnswers(answers: Record<string, number>, questions: QuizQuestion[]): {
    correct: number;
    total: number;
    passed: boolean;
  } {
    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correctOptionIndex) correct += 1;
    }
    return { correct, total: questions.length, passed: correct === questions.length };
  }

  /** Default quiz questions (original content, not copied from commercial games). */
  static getDefaultQuizQuestions(): QuizQuestion[] {
    return [
      {
        id: "q1",
        question: "What should you do if you see spam in chat?",
        options: [
          "Ignore it and keep chatting",
          "Report it to a moderator",
          "Reply with more spam",
          "Delete the channel",
        ],
        correctOptionIndex: 1,
      },
      {
        id: "q2",
        question: "Is it allowed to share invite links to other Discord servers?",
        options: [
          "Yes, always",
          "No, never under any circumstances",
          "Only if a moderator approves",
          "Only in DMs",
        ],
        correctOptionIndex: 2,
      },
      {
        id: "q3",
        question: "What does the @everyone mention do?",
        options: [
          "Notifies only online members",
          "Notifies every member in the server",
          "Sends a DM to the owner",
          "Deletes all messages",
        ],
        correctOptionIndex: 1,
      },
    ];
  }

  /** Captcha expiry in milliseconds. */
  static captchaExpiryMs(): number {
    return CAPTCHA_EXPIRY_MIN * 60 * 1000;
  }

  /** Default kick-after minutes for unverified members. */
  static defaultKickAfterMinutes(strictness: "RELAXED" | "BALANCED" | "STRICT" | "LOCKDOWN"): number | null {
    if (strictness === "RELAXED") return null;
    return 30;
  }
}
