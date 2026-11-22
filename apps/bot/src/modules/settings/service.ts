// §9.5 Settings panel — pure service layer (no discord.js imports).
import {
  describeProfile,
  resolveSetting,
  type SizeTier,
  type Strictness,
} from "@modest/config-engine";
import {
  SettingsCategory,
  CATEGORY_SETTINGS,
  CATEGORY_MODULES,
  SETTING_LABELS,
  MODULE_LABELS,
} from "./schemas.js";

export interface SettingEntry {
  path: string;
  label: string;
  value: unknown;
  isCustom: boolean;
  source: "profile" | "custom";
}

export interface CategoryView {
  category: SettingsCategory;
  settings: SettingEntry[];
  modules: Array<{ key: string; label: string; enabled: boolean }>;
  description: string;
}

export interface SettingsServiceDeps {
  getGuildConfig: (guildId: string) => Promise<{
    sizeTier: SizeTier;
    sizeTierLocked: boolean;
    strictness: Strictness;
    modules: Record<string, boolean>;
    overrides: Record<string, unknown>;
    channelOverrides: Record<string, unknown>;
    staffRoles: Record<string, string[]>;
    logChannels: Record<string, string>;
    modLogChannelId: string | null;
  } | null>;
}

export class SettingsService {
  public deps: SettingsServiceDeps;

  constructor(deps: SettingsServiceDeps) {
    this.deps = deps;
  }

  /** Build the category view for a guild. */
  async getCategoryView(
    guildId: string,
    category: SettingsCategory,
  ): Promise<CategoryView | null> {
    const config = await this.deps.getGuildConfig(guildId);
    if (!config) return null;

    const settingKeys = CATEGORY_SETTINGS[category];
    const moduleKeys = CATEGORY_MODULES[category];

    const settings: SettingEntry[] = [];
    for (const key of settingKeys) {
      const value = resolveSetting(
        {
          guildId,
          sizeTier: config.sizeTier,
          sizeTierLocked: config.sizeTierLocked,
          strictness: config.strictness,
          modules: config.modules,
          overrides: config.overrides,
          channelOverrides: config.channelOverrides as Record<string, any>,
          staffRoles: config.staffRoles,
          logChannels: config.logChannels,
          modLogChannelId: config.modLogChannelId ?? undefined,
        },
        key as any,
        { guildId },
      );
      const isCustom = key in config.overrides;
      settings.push({
        path: key,
        label: SETTING_LABELS[key] ?? key,
        value,
        isCustom,
        source: isCustom ? "custom" : "profile",
      });
    }

    const modules = moduleKeys.map((key) => ({
      key,
      label: MODULE_LABELS[key] ?? key,
      enabled: !!config.modules[key],
    }));

    const descriptions: Record<SettingsCategory, string> = {
      General: "Core server settings like size tier and strictness.",
      Protection: "Anti-nuke and verification settings.",
      AutoMod: "Automated moderation rules for spam, mentions, links, and more.",
      Logging: "Audit log verbosity and channels.",
      Welcome: "Welcome messages and auto-roles for new members.",
      Roles: "Staff role assignments for moderation commands.",
      Reputation: "Reputation and warning settings.",
      XP: "Experience and leveling system settings.",
      Nova: "AI companion settings.",
      "Economy & Games": "Economy, wallets, and server games.",
      Tickets: "Support ticket system settings.",
      Advanced: "Custom overrides, channel overrides, and reset options.",
    };

    return {
      category,
      settings,
      modules,
      description: descriptions[category],
    };
  }

  /** Compute the profile preview lines for a guild's current size/strictness. */
  getPreviewLines(sizeTier: SizeTier, strictness: Strictness): string[] {
    return describeProfile(sizeTier, strictness, "en");
  }
}
