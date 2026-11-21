import type { MessageCreateOptions } from "discord.js";

export const COLORS = {
  success: 0x3ba55d,
  error: 0xed4245,
  warning: 0xfaa61a,
  info: 0x5865f2,
  moderation: {
    ban: 0xed4245,
    kick: 0xf57731,
    timeout: 0xfaa61a,
    warn: 0xfee75c,
    unban: 0x3ba55d,
  },
} as const;

export interface SuccessOptions {
  title?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface ErrorOptions {
  title?: string;
  description?: string;
  errorCode?: string;
}

export function success(options: SuccessOptions = {}): MessageCreateOptions {
  return {
    embeds: [
      {
        title: options.title ?? "Success",
        description: options.description,
        color: COLORS.success,
        fields: options.fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function error(options: ErrorOptions = {}): MessageCreateOptions {
  return {
    embeds: [
      {
        title: options.title ?? "Error",
        description: options.description,
        color: COLORS.error,
        fields: options.errorCode ? [{ name: "Error Code", value: options.errorCode, inline: false }] : undefined,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function warning(options: SuccessOptions = {}): MessageCreateOptions {
  return {
    embeds: [
      {
        title: options.title ?? "Warning",
        description: options.description,
        color: COLORS.warning,
        fields: options.fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function info(options: SuccessOptions = {}): MessageCreateOptions {
  return {
    embeds: [
      {
        title: options.title ?? "Information",
        description: options.description,
        color: COLORS.info,
        fields: options.fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
