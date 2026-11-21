import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy } from "@modest/shared";
import { validateWarnInput } from "../schemas.js";
import { ModerationService, type ModEscalationStep } from "../service.js";
import {
  createCase,
  applyRepPenalty,
  getActiveWarnPoints,
  getLadderCasesInWindow,
  incrementCaseCounter,
  setCaseLogMessageId,
} from "../repository.js";
import { encodeId } from "../../../core/componentIds.js";
import { COLORS } from "../../../core/reply.js";

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

async function sendDm(ctx: CommandContext, guild: any, targetUser: any, reason: string, points: number, cfg: any): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:warn:dm.title", { guild: guild?.name ?? "this server" }))
    .setDescription(
      t("moderation:warn:dm.body", {
        guild: guild?.name ?? "this server",
        action: "Warning",
        reason,
        points,
        moderator: moderatorName(ctx.interaction as any, cfg),
      }),
    )
    .setColor(COLORS.moderation.warn)
    .setTimestamp();
  try {
    await targetUser.send({ embeds: [embed] });
  } catch {
    // DM may be closed or blocked; continue without failing the warn.
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
  points: number,
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel?.isText()) return;
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:warn:modlog.title"))
    .setDescription(
      t("moderation:warn:modlog.body", {
        case: caseNumber,
        target: `<@${targetUser.id}>`,
        moderator: `<@${moderator.id}>`,
        reason,
        points,
      }),
    )
    .setColor(COLORS.moderation.warn)
    .setTimestamp();
  try {
    const message = await channel.send({ embeds: [embed] });
    await setCaseLogMessageId(guild.id, caseNumber, message.id);
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the warn.
  }
}

async function applyEscalationDiscord(
  guild: any,
  targetId: string,
  step: { action: string; durationSec?: number },
  caseNumber: number,
): Promise<void> {
  const reason = `Ladder escalation from warn #${caseNumber}`;
  try {
    if (step.action === "TIMEOUT") {
      const member = guild?.members.cache.get(targetId);
      if (member) await member.timeout((step.durationSec ?? 0) * 1000, reason);
    } else if (step.action === "KICK") {
      const member = guild?.members.cache.get(targetId);
      if (member) await member.kick(reason);
    } else if (step.action === "BAN") {
      await guild?.bans.create(targetId, { reason });
    }
  } catch {
    // Discord escalation action failure is logged by Sentry upstream; the automatic case already exists.
  }
}

export const warnCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member and add warning points.")
    .addUserOption((opt) => opt.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the warning (pick a template or type free text)")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((opt) => opt.setName("points").setDescription("Warning points (1-5)").setMinValue(1).setMaxValue(5))
    .addBooleanOption((opt) => opt.setName("silent").setDescription("Do not DM the user")),
  module: "moderation",
  staffLevel: "helper",
  defer: "ephemeral",
  autocomplete: async (ctx: unknown) => {
    const interaction = (ctx as { interaction: any }).interaction as any;
    const focused = interaction.options.getFocused() as { name: string; value: string | undefined };
    const query = (focused.value ?? "").toString().toLowerCase();
    const cfg = (ctx as { config: any }).config as any;
    const templates = (cfg?.reasonTemplates ?? []) as Array<{ label: string; defaultPoints: number; defaultDuration?: number }>;
    const filtered = templates.filter((t) => String(t.label).toLowerCase().includes(query)).slice(0, 25);
    await interaction.respond(
      filtered.map((t) => ({ name: `${t.label} (${t.defaultPoints ?? 1} pts)`, value: t.label })),
    );
  },
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const guildId = interaction.guildId ?? cfg.guildId ?? "";

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const pointsOpt = interaction.options.getInteger("points");
    const silentOpt = interaction.options.getBoolean("silent");

    const parsed = validateWarnInput({
      user: targetUser.id,
      reason,
      points: pointsOpt ?? 1,
      silent: silentOpt ?? false,
    });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: targetId, reason: cleanReason, points: cleanPoints } = parsed;

    const guild = interaction.guild;
    const targetMember = guild?.members.cache.get(targetId);
    const botMember = guild?.members.cache.get(interaction.client?.user?.id);
    const actorIsOwner = interaction.user.id === guild?.ownerId;
    const targetIsOwner = targetId === guild?.ownerId;
    const targetIsSelf = targetId === interaction.user.id;

    const actorHighest = (interaction.member as any)?.roles?.highest;
    const targetHighest = targetMember?.roles.highest;
    const botHighest = botMember?.roles.highest;
    const targetHighestRoleGeActor = Boolean(targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0);
    const targetHighestRoleGeBot = Boolean(targetHighest && botHighest && targetHighest.comparePosition(botHighest) >= 0);

    // §10.3 Step 1: validate hierarchy and bot permissions
    const hierarchyErr = checkHierarchy({
      targetIsGuildOwner: targetIsOwner,
      targetIsSelf,
      targetHighestRoleGeActor,
      targetHighestRoleGeBot,
      actorIsOwner,
    });
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:warn:error.hierarchy", { message: hierarchyErr }));
      return;
    }

    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty,
      getActiveWarnPoints,
      getLadderCasesInWindow,
    });

    const { caseNumber } = await service.applyWarn(guildId, targetId, interaction.user.id, cleanReason, cleanPoints);

    if (!parsed.silent) {
      await sendDm(ctx, guild, targetUser, cleanReason, cleanPoints, cfg);
    }

    await sendModLog(ctx, guild, cfg, caseNumber, targetUser, interaction.user, cleanReason, cleanPoints);

    const strictness = (getCfg(cfg, "strictness", "BALANCED") as "RELAXED" | "BALANCED" | "STRICT" | "LOCKDOWN");
    const expiryDays =
      typeof getCfg(cfg, "warn.pointExpiryDays", 30) === "number"
        ? (getCfg(cfg, "warn.pointExpiryDays", 30) as number)
        : 30;
    const ladder =
      (getCfg(cfg, "warn.ladder", undefined) as ModEscalationStep[] | undefined) ??
      ModerationService.getDefaultLadder(strictness);
    const activePoints = await service.deps.getActiveWarnPoints(guildId, targetId, expiryDays);
    const escalation = await service.checkEscalation(guildId, targetId, activePoints, ladder, expiryDays);
    if (escalation) {
      await service.applyEscalation(guildId, targetId, interaction.user.id, caseNumber, escalation);
      await applyEscalationDiscord(guild, targetId, escalation, caseNumber);
    }

    // §10.3 Step 9: reply with Undo / View case buttons
    const message = ctx.t("moderation:warn:success", {
      caseNumber,
      user: `<@${targetId}>`,
      points: cleanPoints,
      activePoints,
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "undo", String(caseNumber), interaction.user.id))
        .setLabel("Undo")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "case", "view", String(caseNumber)))
        .setLabel("View case")
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: message, ephemeral: true, components: [row] });
  },
};
