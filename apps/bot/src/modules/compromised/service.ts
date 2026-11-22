// §20.6 Compromised account detection — pure service layer (no discord.js imports).
import { createHash } from "node:crypto";

export interface CompromisedConfig {
  enabled: boolean;
  threshold: number; // number of distinct channels for same link
  timeoutMinutes: number;
}

export interface LinkOccurrence {
  channelId: string;
  messageId: string;
  timestamp: number;
}

export function parseConfig(overrides: Record<string, unknown> | undefined): CompromisedConfig {
  const enabled =
    typeof overrides?.["compromised.enabled"] === "boolean"
      ? (overrides["compromised.enabled"] as boolean)
      : true;
  const threshold =
    typeof overrides?.["compromised.threshold"] === "number"
      ? (overrides["compromised.threshold"] as number)
      : 3;
  const timeoutMinutes =
    typeof overrides?.["compromised.timeoutMinutes"] === "number"
      ? (overrides["compromised.timeoutMinutes"] as number)
      : 60;
  return { enabled, threshold, timeoutMinutes };
}

export function isTrustedOrLegend(rep: number): boolean {
  return rep >= 2000;
}

export function hashLink(url: string): string {
  return createHash("sha256").update(url).digest("hex").substring(0, 16);
}

export function extractLinks(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s<]+/g;
  const matches = content.match(urlRegex);
  return matches ? matches.map((m) => m.replace(/[.,!?)]$/, "")) : [];
}

export function shouldFlagCompromised(
  channelCount: number,
  threshold: number,
): boolean {
  return channelCount >= threshold;
}
