import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import {
  buildPanel,
  buttonRow,
  primaryButton,
  secondaryButton,
  successButton,
  type PanelField,
} from "@modest/shared";
import { buildHubView, chunk, RED_DOT, type HubButton } from "../service.js";
import { parseHubConfig } from "../schemas.js";
import { resolveStaffLevel } from "../../../core/middleware/staff.js";

const MAX_BUTTONS_PER_ROW = 5;

interface HubLoadResult {
  profile: {
    displayName: string;
    level: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    coins: number;
    rep: number;
    bond: number;
    streak: number;
    seasonTier: number;
    seasonTierMax: number;
  };
  today: { questsDone: number; questsTotal: number; dailyRewardReady: boolean };
  newItems: { dailyReward: boolean; completedQuest: boolean; newBadge: boolean; novaMessage: boolean };
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Collect the data the hub renders. Live economy/reputation/quest data is wired in
 * by those modules later; until then the hub degrades to safe defaults so the
 * screen always renders.
 */
function loadHubData(interaction: any, cfg: any): HubLoadResult {
  const member = interaction.member ?? null;
  const displayName =
    (member?.displayName as string | undefined) ??
    (interaction.user?.displayName as string | undefined) ??
    (interaction.user?.username as string | undefined) ??
    "friend";

  const hubCfg = parseHubConfig(cfg);
  void hubCfg;

  return {
    profile: {
      displayName,
      level: num(interaction?.hubProfile?.level),
      xpIntoLevel: num(interaction?.hubProfile?.xpIntoLevel),
      xpForNextLevel: Math.max(1, num(interaction?.hubProfile?.xpForNextLevel, 100)),
      coins: num(interaction?.hubProfile?.coins),
      rep: num(interaction?.hubProfile?.rep),
      bond: num(interaction?.hubProfile?.bond),
      streak: num(interaction?.hubProfile?.streak),
      seasonTier: num(interaction?.hubProfile?.seasonTier),
      seasonTierMax: Math.max(1, num(interaction?.hubProfile?.seasonTierMax, 50)),
    },
    today: {
      questsDone: num(interaction?.hubToday?.questsDone),
      questsTotal: num(interaction?.hubToday?.questsTotal),
      dailyRewardReady: interaction?.hubToday?.dailyRewardReady === true,
    },
    newItems: {
      dailyReward: interaction?.hubNew?.dailyReward === true,
      completedQuest: interaction?.hubNew?.completedQuest === true,
      newBadge: interaction?.hubNew?.newBadge === true,
      novaMessage: interaction?.hubNew?.novaMessage === true,
    },
  };
}

function isStaffUser(ctx: CommandContext, interaction: any): boolean {
  const cfg = ctx.config as { staffRoles?: Record<string, string[]> } | undefined;
  const staffRoles = cfg?.staffRoles ?? {};
  const guildOwnerId = (interaction.guild?.ownerId as string | undefined) ?? "";
  const member = interaction.member ?? null;
  const resolved = resolveStaffLevel(member, staffRoles, guildOwnerId);
  return resolved.level !== "none" || ctx.staffLevel !== "none";
}

function buildButtonRows(buttons: HubButton[], t: (key: string) => string): unknown[] {
  const rows: unknown[] = [];
  for (const rowButtons of chunk(buttons, MAX_BUTTONS_PER_ROW)) {
    const components = rowButtons.map((btn) => {
      const label = `${btn.redDot ? `${RED_DOT} ` : ""}${t(btn.labelKey)}`;
      if (btn.style === "primary") {
        return primaryButton(btn.customId, label, btn.emoji);
      }
      if (btn.style === "success") {
        return successButton(btn.customId, label, btn.emoji);
      }
      return secondaryButton(btn.customId, label, btn.emoji);
    });
    rows.push(buttonRow(...components));
  }
  return rows;
}

export const menuCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("menu")
    .setDescription("Open your Track Modest hub — profile, quests, games, and more.")
    .setDescriptionLocalizations(localizationsFor("menu")),
  module: "core",
  staffLevel: "none",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const t = ctx.t;

    const data = loadHubData(interaction, cfg);
    const staff = isStaffUser(ctx, interaction);

    const view = buildHubView({
      profile: data.profile,
      today: data.today,
      newItems: data.newItems,
      isStaff: staff,
    });

    const fields: PanelField[] = view.fields.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline,
    }));

    const { embed } = buildPanel(
      {
        color: view.color,
        title: view.titleKey,
        description: view.greeting,
        fields,
        footer: "hub.footer",
      },
      t,
    );

    const rows = buildButtonRows(view.buttons, t);

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    await interaction.editReply({
      embeds: [embed],
      components: rows,
      allowedMentions: { parse: [] },
    });
  },
};