import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { checkHierarchy } from "@modest/shared";
import { validateKickInput } from "../schemas.js";
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

async function sendDm(ctx: CommandContext, guild: any, targetUser: any, reason: string, cfg: any): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:kick:dm.title"))
    .setDescription(
      t("moderation:kick:dm.body", {
        guild: guild?.name ?? "this server",
        reason,
        moderator: moderatorName(ctx.interaction as any, cfg),
      }),
    )
    .setColor(COLORS.moderation.timeout)
    .setTimestamp();
  try {
    await targetUser.send({ embeds: [embed] });
  } catch {
    // DMs may be closed; a kick removes the user from the server so we always DM first.
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
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel?.isText()) return;
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:kick:modlog.title"))
    .setDescription(
      t("moderation:kick:modlog.body", {
        case: caseNumber,
        target: `<@${targetUser.id}>`,
        moderator: `<@${moderator.id}>`,
        reason,
      }),
    )
    .setColor(COLORS.moderation.timeout)
    .setTimestamp();
  try {
    const message = await channel.send({ embeds: [embed] });
    await setCaseLogMessageId(guild.id, caseNumber, message.id);
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the action.
  }
}

export const kickCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server.")
    .setDescriptionLocalizations(localizationsFor("kick"))
    .addUserOption((opt) => opt.setName("user").setDescription("Member to kick").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the kick")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  module: "moderation",
  staffLevel: "moderator",
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

    const parsed = validateKickInput({ user: targetUser.id, reason });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: targetId, reason: cleanReason } = parsed;

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:kick:error.notInServer"));
      return;
    }
    const targetMember = guild.members.cache.get(targetId);
    // §10.8: /kick must say the user is not in this server.
    if (!targetMember) {
      await ctx.error(ctx.t("moderation:kick:error.notInServer"));
      return;
    }

    // §10.8: refuse moderating the bot itself.
    if (targetId === interaction.client?.user?.id) {
      await ctx.error(ctx.t("moderation:kick:error.cannotTargetBot"));
      return;
    }

    const botMember = guild.members.cache.get(interaction.client?.user?.id);
    const actorIsOwner = interaction.user.id === guild?.ownerId;
    const targetIsOwner = targetId === guild?.ownerId;
    const targetIsSelf = targetId === interaction.user.id;
    const actorHighest = (interaction.member as any)?.roles?.highest;
    const targetHighest = targetMember?.roles.highest;
    const botHighest = botMember?.roles.highest;
    const targetHighestRoleGeActor = Boolean(targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0);
    const targetHighestRoleGeBot = Boolean(targetHighest && botHighest && targetHighest.comparePosition(botHighest) >= 0);

    // §10.3 Step 1: validate hierarchy and bot permissions.
    const hierarchyErr = checkHierarchy({
      targetIsGuildOwner: targetIsOwner,
      targetIsSelf,
      targetHighestRoleGeActor,
      targetHighestRoleGeBot,
      actorIsOwner,
    });
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:kick:error.hierarchy", { message: hierarchyErr }));
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
    });

    // §10.3 Step 2: reserve an atomic case number before the Discord action.
    const caseNumber = await service.deps.incrementCaseCounter(guildId);

    // §10.3 Step 3: DM BEFORE the action — a kick removes the user from the server.
    await sendDm(ctx, guild, targetUser, cleanReason, cfg);

    // §10.3 Step 4: perform the Discord action. On failure, do NOT create the case.
    try {
      await targetMember.kick(cleanReason);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 50013
          ? ctx.t("moderation:kick:error.missingPermissions")
          : ctx.t("moderation:kick:error.actionFailed");
      await ctx.error(message);
      return;
    }

    // §10.3 Step 5: DB transaction — insert Case, apply rep penalty, update cleanSince.
    const created = await service.deps.createCase({
      guildId,
      type: "KICK",
      targetId,
      moderatorId: interaction.user.id,
      reason: cleanReason,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await service.deps.applyRepPenalty(guildId, targetId, -50);

    // §10.3 Step 7: mod-log + save logMessageId.
    await sendModLog(ctx, guild, cfg, caseNumber, targetUser, interaction.user, cleanReason);

    // §10.3 Step 9: reply with Undo / View case buttons.
    const message = ctx.t("moderation:kick:success", {
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