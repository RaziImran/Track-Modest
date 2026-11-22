import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy, levelSatisfies } from "@modest/shared";
import {
  MAX_TIMEOUT_SECONDS,
  validateTimeoutInput,
  validateUnTimeoutInput,
} from "../schemas.js";
import { ModerationService } from "../service.js";
import {
  applyRepPenalty,
  createCase,
  getActiveWarnPoints,
  getLadderCasesInWindow,
  incrementCaseCounter,
  setCaseLogMessageId,
  findCase,
  undoCase,
  getUserCases,
} from "../repository.js";
import { encodeId } from "../../../core/componentIds.js";
import { COLORS } from "../../../core/reply.js";

// §10.1 / §10.8: Discord only supports timeouts up to 28 days. One hour is the
// helper/moderator staff-level boundary.
const HELPER_MAX_SECONDS = 3600;

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

function moderatorName(interaction: any, cfg: any): string {
  const showName = getCfg(cfg, "dm.showModeratorName", true) !== false;
  if (showName) {
    return interaction.user.displayName ?? interaction.user.username ?? "a moderator";
  }
  return "a moderator";
}

function formatDuration(t: (key: string, params?: Record<string, unknown>) => string, seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(t("moderation:timeout:unit.day", { count: days }));
  if (hours > 0) parts.push(t("moderation:timeout:unit.hour", { count: hours }));
  if (minutes > 0) parts.push(t("moderation:timeout:unit.minute", { count: minutes }));
  if (parts.length === 0) parts.push(t("moderation:timeout:unit.minute", { count: 0 }));
  return parts.join(" ");
}

async function sendDm(
  ctx: CommandContext,
  guild: any,
  targetUser: any,
  reason: string,
  durationSec: number | null,
  cfg: any,
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const isUntime = durationSec === null;
  const body = isUntime
    ? t("moderation:untimeout:dm.body", {
        guild: guild?.name ?? "this server",
        reason,
        moderator: moderatorName(ctx.interaction as any, cfg),
      })
    : t("moderation:timeout:dm.body", {
        guild: guild?.name ?? "this server",
        reason,
        duration: formatDuration(t, durationSec),
        moderator: moderatorName(ctx.interaction as any, cfg),
      });
  const embed = new EmbedBuilder()
    .setTitle(isUntime ? t("moderation:untimeout:dm.title") : t("moderation:timeout:dm.title"))
    .setDescription(body)
    .setColor(isUntime ? COLORS.success : COLORS.moderation.timeout)
    .setTimestamp();
  try {
    await targetUser.send({ embeds: [embed] });
  } catch {
    // DMs may be closed; a timeout removes interaction ability so we always DM first.
  }
}

async function sendModLog(
  ctx: CommandContext,
  guild: any,
  cfg: any,
  caseNumber: number,
  targetUser: any,
  moderator: any,
  reason: string,
  durationSec: number | null,
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel?.isText()) return;
  const isUntime = durationSec === null;
  const embed = new EmbedBuilder()
    .setTitle(isUntime ? t("moderation:untimeout:modlog.title") : t("moderation:timeout:modlog.title"))
    .setDescription(
      isUntime
        ? t("moderation:untimeout:modlog.body", {
            case: caseNumber,
            target: `<@${targetUser.id}>`,
            moderator: `<@${moderator.id}>`,
            reason,
          })
        : t("moderation:timeout:modlog.body", {
            case: caseNumber,
            target: `<@${targetUser.id}>`,
            moderator: `<@${moderator.id}>`,
            reason,
            duration: formatDuration(t, durationSec),
          }),
    )
    .setColor(isUntime ? COLORS.success : COLORS.moderation.timeout)
    .setTimestamp();
  try {
    const message = await channel.send({ embeds: [embed] });
    await setCaseLogMessageId(guild.id, caseNumber, message.id);
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the action.
  }
}

// Shared §10.3 hierarchy validation (steps 1-2).
function hierarchyError(
  interaction: any,
  guild: any,
  targetId: string,
): string | null {
  const targetMember = guild?.members.cache.get(targetId);
  const botMember = guild?.members.cache.get(interaction.client?.user?.id);
  const actorIsOwner = interaction.user.id === guild?.ownerId;
  const targetIsOwner = targetId === guild?.ownerId;
  const targetIsSelf = targetId === interaction.user.id;
  const actorHighest = (interaction.member as any)?.roles?.highest;
  const targetHighest = targetMember?.roles.highest;
  const botHighest = botMember?.roles.highest;
  const targetHighestRoleGeActor = Boolean(
    targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0,
  );
  const targetHighestRoleGeBot = Boolean(
    targetHighest && botHighest && targetHighest.comparePosition(botHighest) >= 0,
  );
  return checkHierarchy({
    targetIsGuildOwner: targetIsOwner,
    targetIsSelf,
    targetHighestRoleGeActor,
    targetHighestRoleGeBot,
    actorIsOwner,
  });
}

export const timeoutCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily mute a member (Discord timeout).")
    .setDescriptionLocalizations(localizationsFor("timeout"))
    .addUserOption((opt) => opt.setName("user").setDescription("Member to time out").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Duration (e.g. 5m, 10m, 1h, 6h, 1d, 7d, 28d; also 90m, 2h30m)")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the timeout")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  module: "moderation",
  // Static floor; the >1h moderator requirement is enforced dynamically in execute().
  staffLevel: "helper",
  defer: "ephemeral",
  autocomplete: async (ctx: unknown) => {
    const interaction = (ctx as { interaction: any }).interaction as any;
    const focused = interaction.options.getFocused() as { name: string; value: string | undefined };
    const query = (focused.value ?? "").toString().toLowerCase();
    const cfg = (ctx as { config: any }).config as any;
    if (focused.name === "reason") {
      const templates = (cfg?.reasonTemplates ?? []) as Array<{ label: string }>;
      const filtered = templates.filter((tpl) => String(tpl.label).toLowerCase().includes(query)).slice(0, 25);
      await interaction.respond(filtered.map((tpl) => ({ name: tpl.label, value: tpl.label })));
      return;
    }
    const durations = ["5m", "10m", "1h", "6h", "1d", "7d", "28d"];
    const filtered = durations.filter((d) => d.toLowerCase().includes(query)).slice(0, 25);
    await interaction.respond(filtered.map((d) => ({ name: d, value: d })));
  },
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const durationRaw = interaction.options.getString("duration", true);

    const parsed = validateTimeoutInput({ user: targetUser.id, duration: durationRaw, reason });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: targetId, duration: durationStr, reason: cleanReason } = parsed;

    let durationSec: number;
    try {
      durationSec = ModerationService.parseDuration(durationStr);
    } catch {
      await ctx.error(ctx.t("moderation:timeout:error.invalidDuration"));
      return;
    }
    if (durationSec <= 0) {
      await ctx.error(ctx.t("moderation:timeout:error.invalidDuration"));
      return;
    }

    // §10.8: refuse timeouts longer than Discord's 28-day limit and suggest tempban.
    if (durationSec > MAX_TIMEOUT_SECONDS) {
      await ctx.error(ctx.t("moderation:timeout:error.tooLong"));
      return;
    }

    // Staff-level gate: helper up to 1h, moderator beyond.
    if (durationSec > HELPER_MAX_SECONDS && !levelSatisfies("moderator", ctx.staffLevel)) {
      await ctx.error(ctx.t("moderation:timeout:error.needModerator"));
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:timeout:error.notInServer"));
      return;
    }
    const targetMember = guild.members.cache.get(targetId);
    // §10.8: /timeout must say the user is not in this server.
    if (!targetMember) {
      await ctx.error(ctx.t("moderation:timeout:error.notInServer"));
      return;
    }

    // §10.8: refuse moderating the bot itself.
    if (targetId === interaction.client?.user?.id) {
      await ctx.error(ctx.t("moderation:timeout:error.cannotTargetBot"));
      return;
    }

    // §10.3 Step 1: validate hierarchy and bot permissions.
    const hierarchyErr = hierarchyError(interaction, guild, targetId);
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:timeout:error.hierarchy", { message: hierarchyErr }));
      return;
    }

    const botWarn = targetUser.bot
      ? ctx.t("moderation:timeout:warning.targetIsBot")
      : "";

    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty,
      getActiveWarnPoints,
      getLadderCasesInWindow,
      findCase,
      undoCase,
      getUserCases,
    });

    // §10.3 Step 2: reserve an atomic case number before the Discord action.
    const caseNumber = await service.deps.incrementCaseCounter(guildId);

    // §10.3 Step 3: DM BEFORE the action — a timeout removes the ability to act.
    await sendDm(ctx, guild, targetUser, cleanReason, durationSec, cfg);

    // §10.3 Step 4: perform the Discord action. On failure, do NOT create the case.
    try {
      await targetMember.timeout(durationSec * 1000, cleanReason);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 50013
          ? ctx.t("moderation:timeout:error.missingPermissions")
          : ctx.t("moderation:timeout:error.actionFailed");
      await ctx.error(message);
      return;
    }

    // §10.3 Step 5: DB transaction — insert Case, apply rep penalty, update cleanSince.
    const created = await service.deps.createCase({
      guildId,
      type: "TIMEOUT",
      targetId,
      moderatorId: interaction.user.id,
      reason: cleanReason,
      durationSec,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await service.deps.applyRepPenalty(guildId, targetId, -50);

    // §10.3 Step 7: mod-log + save logMessageId.
    await sendModLog(ctx, guild, cfg, caseNumber, targetUser, interaction.user, cleanReason, durationSec);

    // §10.3 Step 9: reply with Undo / View case buttons.
    const message = ctx.t("moderation:timeout:success", {
      caseNumber,
      caseId: created.id,
      user: `<@${targetId}>`,
      duration: formatDuration(ctx.t as (key: string, params?: Record<string, unknown>) => string, durationSec),
      warn: botWarn,
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "undo", String(caseNumber)))
        .setLabel("Undo")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "case", "view", String(caseNumber)))
        .setLabel("View case")
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: message, ephemeral: true, components: [row], allowedMentions: { parse: [] } });
  },
};

export const untimeoutCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a member's timeout.")
    .setDescriptionLocalizations(localizationsFor("untimeout"))
    .addUserOption((opt) => opt.setName("user").setDescription("Member to remove the timeout from").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for removing the timeout")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  module: "moderation",
  staffLevel: "helper",
  defer: "ephemeral",
  autocomplete: async (ctx: unknown) => {
    const interaction = (ctx as { interaction: any }).interaction as any;
    const focused = interaction.options.getFocused() as { name: string; value: string | undefined };
    const query = (focused.value ?? "").toString().toLowerCase();
    const cfg = (ctx as { config: any }).config as any;
    const templates = (cfg?.reasonTemplates ?? []) as Array<{ label: string }>;
    const filtered = templates.filter((tpl) => String(tpl.label).toLowerCase().includes(query)).slice(0, 25);
    await interaction.respond(filtered.map((tpl) => ({ name: tpl.label, value: tpl.label })));
  },
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    const parsed = validateUnTimeoutInput({ user: targetUser.id, reason });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: targetId, reason: cleanReason } = parsed;

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:untimeout:error.notInServer"));
      return;
    }
    const targetMember = guild.members.cache.get(targetId);
    // §10.8: /untimeout must say the user is not in this server.
    if (!targetMember) {
      await ctx.error(ctx.t("moderation:untimeout:error.notInServer"));
      return;
    }

    // §10.3 Step 1: validate hierarchy and bot permissions.
    const hierarchyErr = hierarchyError(interaction, guild, targetId);
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:untimeout:error.hierarchy", { message: hierarchyErr }));
      return;
    }

    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty,
      getActiveWarnPoints,
      getLadderCasesInWindow,
      findCase,
      undoCase,
      getUserCases,
    });

    // §10.3 Step 2: reserve an atomic case number before the Discord action.
    const caseNumber = await service.deps.incrementCaseCounter(guildId);

    // Untimeout does not remove interaction ability, but DM before the action for consistency.
    await sendDm(ctx, guild, targetUser, cleanReason, null, cfg);

    // §10.3 Step 4: perform the Discord action. On failure, do NOT create the case.
    try {
      await targetMember.timeout(null, cleanReason);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 50013
          ? ctx.t("moderation:untimeout:error.missingPermissions")
          : ctx.t("moderation:untimeout:error.actionFailed");
      await ctx.error(message);
      return;
    }

    // §10.3 Step 5: DB transaction — insert Case (no rep change for untimeout).
    const created = await service.deps.createCase({
      guildId,
      type: "UNTIMEOUT",
      targetId,
      moderatorId: interaction.user.id,
      reason: cleanReason,
      points: 0,
      caseNumber,
      automatic: false,
    });

    // §10.3 Step 7: mod-log + save logMessageId.
    await sendModLog(ctx, guild, cfg, caseNumber, targetUser, interaction.user, cleanReason, null);

    // §10.3 Step 9: reply with Undo / View case buttons.
    const message = ctx.t("moderation:untimeout:success", {
      caseNumber,
      caseId: created.id,
      user: `<@${targetId}>`,
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "undo", String(caseNumber)))
        .setLabel("Undo")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "case", "view", String(caseNumber)))
        .setLabel("View case")
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: message, ephemeral: true, components: [row], allowedMentions: { parse: [] } });
  },
};