import { registerCommand } from "../../core/commandRegistry.js";
import { setupCommand } from "./commands/setup.js";
import { client } from "../../client.js";
import {
  Events,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import {
  getSetupState,
  setSetupState,
  deleteSetupState,
  ensureGuildAndConfig,
  applySetupConfig,
} from "./repository.js";
import { SetupService } from "./service.js";
import {
  type SetupState,
  type SupportedLocale,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
} from "./schemas.js";
import { COLORS } from "../../core/reply.js";

const SETUP_STATE_TTL_SEC = 60 * 30; // 30 minutes

registerCommand(setupCommand, import.meta.url);

const service = new SetupService({
  getSetupState,
  setSetupState,
  deleteSetupState,
});

async function loadOrCreateState(
  guildId: string,
  userId: string,
): Promise<SetupState> {
  return service.getOrCreateState(guildId, userId);
}

// ── Step renderers ──

function renderStep1(
  state: SetupState,
  guild: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  const current = state.locale ?? guild.preferredLocale ?? "en";
  const embed = new EmbedBuilder()
    .setTitle(t("setup:step1.title"))
    .setDescription(t("setup:step1.description"))
    .setColor(COLORS.info)
    .addFields({
      name: t("setup:step1.field.current"),
      value: current,
    });

  const localeSelect = new StringSelectMenuBuilder()
    .setCustomId("setup:select:locale")
    .setPlaceholder(t("setup:step1.field.placeholder"))
    .setMinValues(1)
    .setMaxValues(1);

  for (const loc of SUPPORTED_LOCALES) {
    localeSelect.addOptions([
      {
        label: LOCALE_LABELS[loc] ?? loc,
        value: loc,
        default: loc === current,
      },
    ]);
  }

  return {
    embeds: [embed],
    components: [
      { type: 1, components: [localeSelect] },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:next:1",
            label: t("setup:button.next"),
            style: 1,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:skip:1",
            label: t("setup:button.skip"),
            style: 2,
            disabled: false,
          },
        ],
      },
    ],
  };
}

function renderStep2(
  _state: SetupState,
  _guild: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  void _state;
  void _guild;
  const embed = new EmbedBuilder()
    .setTitle(t("setup:step2.title"))
    .setDescription(t("setup:step2.description"))
    .setColor(COLORS.info);

  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:preset:Gaming",
            label: "\u{1F3AE} Gaming",
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:preset:Study",
            label: "\u{1F4DA} Study",
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:preset:Creator",
            label: "\u{1F3A5} Creator",
            style: 2,
            disabled: false,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:preset:Friends",
            label: "\u{1F465} Friends",
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:preset:Large public",
            label: "\u{1F30D}\u{200D}\u{1F30B} Large public",
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:preset:Custom",
            label: "\u{2699}\u{FE0F} Custom",
            style: 2,
            disabled: false,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:prev:2",
            label: t("setup:button.back"),
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:next:2",
            label: t("setup:button.next"),
            style: 1,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:skip:2",
            label: t("setup:button.skip"),
            style: 2,
            disabled: false,
          },
        ],
      },
    ],
  };
}

function renderStep3(
  state: SetupState,
  guild: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  const memberCount = guild.memberCount ?? 0;
  const autoTier = service.resolveSizeTier(memberCount);
  const current = state.sizeTier ?? autoTier;

  const tiers: Array<"TINY" | "SMALL" | "MEDIUM" | "LARGE" | "MASSIVE"> = [
    "TINY",
    "SMALL",
    "MEDIUM",
    "LARGE",
    "MASSIVE",
  ];
  const tierLabels: Record<string, string> = {
    TINY: "Tiny (<50)",
    SMALL: "Small (50\u2013499)",
    MEDIUM: "Medium (500\u20134,999)",
    LARGE: "Large (5,000\u201349,999)",
    MASSIVE: "Massive (50,000+)",
  };

  const embed = new EmbedBuilder()
    .setTitle(t("setup:step3.title"))
    .setDescription(
      t("setup:step3.description", {
        autoDetected: tierLabels[autoTier],
        memberCount,
      }),
    )
    .setColor(COLORS.info);

  const components: any[] = tiers.map((tier) => ({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: `setup:size:${tier}`,
        label: `${tier === current ? "\u2713 " : ""}${tierLabels[tier]}`,
        style: tier === current ? 3 : 2,
        disabled: tier === current,
      },
    ],
  }));

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: "setup:prev:3",
        label: t("setup:button.back"),
        style: 2,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:next:3",
        label: t("setup:button.next"),
        style: 1,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:skip:3",
        label: t("setup:button.skip"),
        style: 2,
        disabled: false,
      },
    ],
  });

  return { embeds: [embed], components };
}

function renderStep4(
  state: SetupState,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  const current = state.strictness ?? "BALANCED";
  const levels: Array<"RELAXED" | "BALANCED" | "STRICT" | "LOCKDOWN"> = [
    "RELAXED",
    "BALANCED",
    "STRICT",
    "LOCKDOWN",
  ];
  const levelLabels: Record<string, string> = {
    RELAXED: "Relaxed",
    BALANCED: "Balanced",
    STRICT: "Strict",
    LOCKDOWN: "Lockdown",
  };
  const levelDescs: Record<string, string> = {
    RELAXED: "Fewer auto-actions, more manual review",
    BALANCED: "Good balance of automation and review",
    STRICT: "More aggressive auto-moderation",
    LOCKDOWN: "Maximum protection, minimal automation",
  };

  const embed = new EmbedBuilder()
    .setTitle(t("setup:step4.title"))
    .setDescription(t("setup:step4.description"))
    .setColor(COLORS.info);

  const components: any[] = levels.map((level) => ({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: `setup:strictness:${level}`,
        label: `${level === current ? "\u2713 " : ""}${levelLabels[level]}`,
        style: level === current ? 3 : 2,
        disabled: level === current,
      },
      {
        type: 2,
        custom_id: `setup:strictnessdesc:${level}`,
        label: levelDescs[level],
        style: 2,
        disabled: true,
      },
    ],
  }));

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: "setup:prev:4",
        label: t("setup:button.back"),
        style: 2,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:next:4",
        label: t("setup:button.next"),
        style: 1,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:skip:4",
        label: t("setup:button.skip"),
        style: 2,
        disabled: false,
      },
    ],
  });

  return { embeds: [embed], components };
}

function renderStep5(
  _state: SetupState,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  void _state;
  const roleTypes: Array<{ key: string; label: string }> = [
    { key: "admin", label: "Admin" },
    { key: "moderator", label: "Moderator" },
    { key: "helper", label: "Helper" },
  ];

  const embed = new EmbedBuilder()
    .setTitle(t("setup:step5.title"))
    .setDescription(t("setup:step5.description"))
    .setColor(COLORS.info);

  const components: any[] = roleTypes.map(({ key }) => ({
    type: 1,
    components: [
      {
        type: 3,
        custom_id: `setup:select:staffRoles:${key}`,
        placeholder: `Select roles`,
        min_values: 0,
        max_values: 10,
        disabled: false,
      },
    ],
  }));

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: "setup:prev:5",
        label: t("setup:button.back"),
        style: 2,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:next:5",
        label: t("setup:button.next"),
        style: 1,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:skip:5",
        label: t("setup:button.skip"),
        style: 2,
        disabled: false,
      },
    ],
  });

  return { embeds: [embed], components };
}

function renderStep6(
  _state: SetupState,
  _guild: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  void _state;
  void _guild;
  const embed = new EmbedBuilder()
    .setTitle(t("setup:step6.title"))
    .setDescription(t("setup:step6.description"))
    .setColor(COLORS.info);

  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "setup:select:channel:modLogChannelId",
            placeholder: "Select mod-log channel",
            min_values: 0,
            max_values: 1,
            channel_types: [0],
            disabled: false,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:create:channels",
            label: t("setup:button.createChannels"),
            style: 1,
            disabled: false,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:prev:6",
            label: t("setup:button.back"),
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:next:6",
            label: t("setup:button.next"),
            style: 1,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:skip:6",
            label: t("setup:button.skip"),
            style: 2,
            disabled: false,
          },
        ],
      },
    ],
  };
}

function renderStep7(
  state: SetupState,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  const modules = state.modules;
  const moduleCats: Array<{ key: string; label: string }> = [
    { key: "automod", label: "AutoMod" },
    { key: "antiraid", label: "Anti-raid" },
    { key: "logging", label: "Logging" },
    { key: "welcome", label: "Welcome" },
    { key: "rep", label: "Reputation" },
    { key: "xp", label: "XP & Levels" },
    { key: "tickets", label: "Tickets" },
    { key: "nova", label: "Nova (AI)" },
    { key: "economy", label: "Economy" },
    { key: "games", label: "Games" },
  ];

  const embed = new EmbedBuilder()
    .setTitle(t("setup:step7.title"))
    .setDescription(t("setup:step7.description"))
    .setColor(COLORS.info);

  const components: any[] = moduleCats.map((cat) => ({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: `setup:module:${cat.key}`,
        label: `${modules[cat.key] ? "\u2713 " : ""}${cat.label}`,
        style: modules[cat.key] ? 3 : 2,
        disabled: false,
      },
    ],
  }));

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: "setup:prev:7",
        label: t("setup:button.back"),
        style: 2,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:next:7",
        label: t("setup:button.next"),
        style: 1,
        disabled: false,
      },
      {
        type: 2,
        custom_id: "setup:skip:7",
        label: t("setup:button.skip"),
        style: 2,
        disabled: false,
      },
    ],
  });

  return { embeds: [embed], components };
}

function renderStep8(
  state: SetupState,
  guild: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embeds: any[]; components: any[] } {
  void guild;
  const previewLines = service.getPreviewLines(
    state.sizeTier ?? "SMALL",
    state.strictness ?? "BALANCED",
    state.locale as any,
  );

  const embed = new EmbedBuilder()
    .setTitle(t("setup:step8.title"))
    .setDescription(t("setup:step8.description"))
    .setColor(COLORS.info)
    .addFields({
      name: t("setup:step8.field.preview"),
      value: previewLines.join("\n") || t("setup:step8.field.noChanges"),
    });

  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "setup:prev:8",
            label: t("setup:button.back"),
            style: 2,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:apply",
            label: t("setup:button.apply"),
            style: 3,
            disabled: false,
          },
          {
            type: 2,
            custom_id: "setup:cancel",
            label: t("setup:button.cancel"),
            style: 4,
            disabled: false,
          },
        ],
      },
    ],
  };
}

// ── Step renderer map ──

const STEP_RENDERERS: Record<
  number,
  (state: SetupState, guild: any, t: any) => any
> = {
  1: (_state: SetupState, guild: any, t: any) => renderStep1(_state, guild, t),
  2: renderStep2,
  3: renderStep3,
  4: renderStep4,
  5: renderStep5,
  6: renderStep6,
  7: renderStep7,
  8: renderStep8,
};

async function renderStep(
  interaction: any,
  state: SetupState,
  guild: any,
  t: (key: string, params?: Record<string, unknown>) => string,
): Promise<void> {
  const renderer = STEP_RENDERERS[state.step];
  if (!renderer) return;
  const result = renderer(state, guild, t);
  await interaction.update(result);
}

// ── Interaction handler ──

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("setup:")) return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Setup must be run in a server.", ephemeral: true });
    return;
  }

  const parts = customId.split(":");
  const action = parts[1];
  const userId = interaction.user.id;

  let state = await loadOrCreateState(guild.id, userId);
  const t = (key: string) => key;

  try {
    switch (action) {
      case "next": {
        const step = Number.parseInt(parts[2] ?? "", 10);
        if (state.step !== step) break;
        state = service.nextStep(state);
        await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "prev": {
        const step = Number.parseInt(parts[2] ?? "", 10);
        if (state.step !== step) break;
        state = service.prevStep(state);
        await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "skip": {
        const step = Number.parseInt(parts[2] ?? "", 10);
        if (state.step !== step) break;
        state = service.nextStep(state);
        await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "preset": {
        const preset = parts[2] as string;
        state = service.applyPreset(state, preset as any);
        await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "size": {
        const tier = parts[2] as string;
        state = await service.updateState(guild.id, userId, { sizeTier: tier as any });
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "strictness": {
        const level = parts[2] as string;
        state = await service.updateState(guild.id, userId, { strictness: level as any });
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "module": {
        const key = parts[2];
        const current = state.modules[key ?? ""] ?? false;
        state = await service.updateState(guild.id, userId, {
          modules: { ...state.modules, [key ?? ""]: !current },
        });
        await renderStep(interaction, state, guild, t);
        break;
      }
      case "select": {
        const target = parts[2];
        if (target === "staffRoles") {
          const roleType = parts[3] ?? "";
          const values = (interaction as any).values ?? [];
          state = await service.updateState(guild.id, userId, {
            staffRoles: { ...state.staffRoles, [roleType]: values },
          });
          await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
          await renderStep(interaction, state, guild, t);
        } else if (target === "channel") {
          const channelType = parts[3] ?? "";
          const values = (interaction as any).values ?? [];
          state = await service.updateState(guild.id, userId, {
            channels: {
              ...state.channels,
              [channelType]: values[0] ?? undefined,
            },
          });
          await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
          await renderStep(interaction, state, guild, t);
        } else if (target === "locale") {
          const value = (interaction as any).values?.[0];
          if (value && SUPPORTED_LOCALES.includes(value as SupportedLocale)) {
            state = await service.updateState(guild.id, userId, { locale: value as SupportedLocale });
            await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
            await renderStep(interaction, state, guild, t);
          }
        }
        break;
      }
      case "create": {
        if (parts[2] === "channels") {
          try {
            const modLog = await guild.channels.create({
              name: "mod-log",
              type: 0,
              topic: "Moderation log channel",
            });
            const welcome = await guild.channels.create({
              name: "welcome",
              type: 0,
              topic: "Welcome channel",
            });
            state = await service.updateState(guild.id, userId, {
              channels: {
                modLogChannelId: modLog.id,
                welcomeChannelId: welcome.id,
              },
            });
            await setSetupState(guild.id, userId, state, SETUP_STATE_TTL_SEC);
            await renderStep(interaction, state, guild, t);
          } catch {
            await interaction.reply({
              content: "Failed to create channels. Please check my permissions.",
              ephemeral: true,
            });
          }
        }
        break;
      }
      case "apply": {
        const finalConfig = service.computeFinalConfig(state);
        await ensureGuildAndConfig(guild.id, guild.name, guild.ownerId);
        await applySetupConfig(guild.id, interaction.user.id, finalConfig);
        await deleteSetupState(guild.id, userId);

        await interaction.update({
          embeds: [
            (new EmbedBuilder()
              .setTitle(t("setup:complete.title"))
              .setDescription(t("setup:complete.description"))
              .setColor(COLORS.success)
              .addFields({
                name: "Next step",
                value: "Run `/checkperms` (Permission Doctor) to verify the bot has the permissions it needs for your enabled modules.",
                inline: false,
              }) as any),
          ],
          components: [],
        });
        break;
      }
      case "cancel": {
        await deleteSetupState(guild.id, userId);
        await interaction.update({
          embeds: [
            (new EmbedBuilder()
              .setTitle(t("setup:cancel.title"))
              .setDescription(t("setup:cancel.description"))
              .setColor(COLORS.error) as any),
          ],
          components: [],
        });
        break;
      }
    }
  } catch (err) {
    await interaction.reply({
      content: "An error occurred during setup. Please try again.",
      ephemeral: true,
    });
  }
});

export { setupCommand };
