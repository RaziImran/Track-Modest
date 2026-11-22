export type Locale = string;

/**
 * Locales the bot ships localisations for. Launch is `en` only (§31); the
 * remaining locales are planned and fall back to `en` until translated.
 */
export const supportedLocales: readonly Locale[] = [
  "en",
  "es",
  "pt-BR",
  "fr",
  "de",
  "hi",
  "ur",
  "ar",
  "tr",
  "id",
];

export interface CommandDescriptionMap {
  [command: string]: Partial<Record<Locale, string>>;
}

export const commandDescriptions: CommandDescriptionMap = {
  warn: { en: "Warn a member and add warning points." },
  timeout: { en: "Temporarily mute a member (Discord timeout)." },
  untimeout: { en: "Remove a member's timeout." },
  kick: { en: "Kick a member from the server." },
  ban: { en: "Ban a user from the server (optionally temporary)." },
  softban: { en: "Softban a user (ban with 1 day message deletion, then unban)." },
  unban: { en: "Unban a user from the server." },
  purge: { en: "Delete messages in bulk with optional filters." },
  lock: { en: "Lock, unlock, or set slowmode on a channel." },
  lockdown: { en: "Lock down or unlock all public text channels in the server." },
  nick: { en: "Change another member's server nickname." },
  menu: { en: "Open your Track Modest hub — profile, quests, games, and more." },
  strictness: { en: "Manage temporary strictness boosts (admin only)." },
  settings: { en: "Configure server settings via an interactive panel." },
  history: { en: "Show a member's moderation case history and active warning points." },
  modstats: { en: "Moderation statistics for this server." },
  note: { en: "Add, list, or delete moderation notes for a member." },
  report: { en: "Report a user for rule violations." },
};

/**
 * Localisation map for a command, keyed by Discord locale. Missing locales
 * fall back to `en` via {@link getCommandDescription}.
 */
export function localizationsFor(commandName: string): Record<string, string> {
  return Object.fromEntries(
    supportedLocales.map((locale) => [locale, getCommandDescription(commandName, locale)]),
  );
}

/**
 * Resolve a command description for a locale, falling back to `en` when the
 * locale translation is missing.
 */
export function getCommandDescription(commandName: string, locale: Locale): string {
  const byLocale = commandDescriptions[commandName];
  if (!byLocale) return "";
  return byLocale[locale] ?? byLocale["en"] ?? "";
}
