// §9 Setup wizard — pure service layer (no discord.js imports).
import type {
  SetupState,
  SetupPreset,
  SetupSizeTier,
  SetupStrictness,
  SupportedLocale,
} from "./schemas.js";
import {
  initialSetupState,
  PRESETS,
} from "./schemas.js";
import { describeProfile } from "@modest/config-engine";
import type { SizeTier, Strictness } from "@modest/config-engine";

export interface SetupServiceDeps {
  getSetupState: (guildId: string, userId: string) => Promise<SetupState | null>;
  setSetupState: (
    guildId: string,
    userId: string,
    state: SetupState,
    ttlSec?: number,
  ) => Promise<void>;
  deleteSetupState: (guildId: string, userId: string) => Promise<void>;
}

export class SetupService {
  public deps: SetupServiceDeps;

  constructor(deps: SetupServiceDeps) {
    this.deps = deps;
  }

  async getOrCreateState(
    guildId: string,
    userId: string,
  ): Promise<SetupState> {
    const existing = await this.deps.getSetupState(guildId, userId);
    if (existing) return existing;
    const initial = initialSetupState();
    await this.deps.setSetupState(guildId, userId, initial);
    return initial;
  }

  async updateState(
    guildId: string,
    userId: string,
    updates: Partial<SetupState>,
  ): Promise<SetupState> {
    const current = await this.getOrCreateState(guildId, userId);
    const next: SetupState = { ...current, ...updates };
    await this.deps.setSetupState(guildId, userId, next);
    return next;
  }

  async clearState(guildId: string, userId: string): Promise<void> {
    await this.deps.deleteSetupState(guildId, userId);
  }

  /** Apply a preset to the setup state. */
  applyPreset(state: SetupState, preset: SetupPreset): SetupState {
    const def = PRESETS[preset];
    return {
      ...state,
      preset,
      strictness: def.strictness,
      modules: { ...state.modules, ...def.modules },
    };
  }

  /** Advance to the next step, capping at 8. */
  nextStep(state: SetupState): SetupState {
    return { ...state, step: Math.min(state.step + 1, 8) };
  }

  /** Go to the previous step, flooring at 1. */
  prevStep(state: SetupState): SetupState {
    return { ...state, step: Math.max(state.step - 1, 1) };
  }

  /** Get the resolved size tier from member count. */
  resolveSizeTier(memberCount: number): SetupSizeTier {
    if (memberCount < 50) return "TINY";
    if (memberCount < 500) return "SMALL";
    if (memberCount < 5000) return "MEDIUM";
    if (memberCount < 50000) return "LARGE";
    return "MASSIVE";
  }

  /** Render the preview lines for step 8 using describeProfile. */
  getPreviewLines(
    sizeTier: SetupSizeTier,
    strictness: SetupStrictness,
    locale: SupportedLocale | undefined,
  ): string[] {
    return describeProfile(
      sizeTier as SizeTier,
      strictness as Strictness,
      locale ?? "en",
    );
  }

  /** Compute the final config payload to write on Apply. */
  computeFinalConfig(state: SetupState): {
    locale: string;
    sizeTier: SetupSizeTier;
    sizeTierLocked: boolean;
    strictness: SetupStrictness;
    staffRoles: Record<string, string[]>;
    modLogChannelId: string | undefined;
    logChannels: Record<string, string>;
    modules: Record<string, boolean>;
  } {
    return {
      locale: state.locale ?? "en",
      sizeTier: state.sizeTier ?? "SMALL",
      sizeTierLocked: true, // user chose size in wizard
      strictness: state.strictness ?? "BALANCED",
      staffRoles: state.staffRoles,
      modLogChannelId: state.channels.modLogChannelId,
      logChannels: state.channels.modLogChannelId
        ? { modLog: state.channels.modLogChannelId }
        : {},
      modules: state.modules,
    };
  }
}
