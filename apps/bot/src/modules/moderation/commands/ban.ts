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
import { validateBanInput } from "../schemas.js";
import { ModerationService } from "../service.js";
import {
  applyRepPenalty,
  createCase,
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

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("0m");
  return parts.join(" ");
}

const DELETE_MESSAGE_SECONDS: Record<string, number> = {
  none: 0,
  "1h": 3600,
  "24h": 86400,
  "7d": 604800,
};

async function sendDm(
  ctx: CommandContext,
  guild: any,
  targetUser: any,
  reason: string,
  durationSec: number | undefined,
  cfg: any,
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const durationLine = durationSec ? `\n**Duration:** ${formatDuration(durationSec)}` : "";
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:ban:dm.title"))
    .setDescription(
      t("moderation:ban:dm.body", {
        guild: guild?.name ?? "this server",
        reason,
        duration: durationLine,
        moderator: moderatorName(ctx.interaction as any, cfg),
      }),
    )
    .setColor(COLORS.moderation.ban)
    .setTimestamp();
  try {
    await targetUser.send({ embeds: [embed] });
  } catch {
    // DMs may be closed; a ban removes the user from the server so we always DM first.
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
  durationSec: number | undefined,
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel?.isText()) return;
  const durationLine = durationSec ? ` for ${formatDuration(durationSec)}` : "";
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:ban:modlog.title"))
    .setDescription(
      t("moderation:ban:modlog.body", {
        case: caseNumber,
        target: `<@${targetUser.id}>`,
        moderator: `<@${moderator.id}>`,
        reason,
        duration: durationLine,
      }),
    )
    .setColor(COLORS.moderation.ban)
    .setTimestamp();
  try {
    const message = await channel.send({ embeds: [embed] });
    await setCaseLogMessageId(guild.id, caseNumber, message.id);
  } catch {
    // Mod-log channel may be inaccessible; continue without failing the action.
  }
}

export const banCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server (optionally temporary).")
    .setDescriptionLocalizations(localizationsFor("ban"))
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to ban (a user ID works even if they are not in the server)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Optional duration for a tempban (e.g. 7d, 2w). Omit for a permanent ban.")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("delete_messages")
        .setDescription("Messages to delete with the ban")
        .addChoices(
          { name: "None", value: "none" },
          { name: "Last 1 hour", value: "1h" },
          { name: "Last 24 hours", value: "24h" },
          { name: "Last 7 days", value: "7d" },
        )
        .setRequired(false),
    ),
  module: "moderation",
  staffLevel: "moderator",
  defer: "ephemeral",
  autocomplete: async (ctx: unknown) => {
    const interaction = (ctx as { interaction: any }).interaction as any;
    const focused = interaction.options.getFocused() as { name: string; value: string | undefined };
    if (focused.name !== "reason") return;
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
    const durationRaw = interaction.options.getString("duration");
    const deleteMessagesRaw = interaction.options.getString("delete_messages");

    const parsed = validateBanInput({
      user: targetUser.id,
      reason,
      duration: durationRaw ?? undefined,
      deleteMessages: deleteMessagesRaw ?? "none",
    });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: targetId, reason: cleanReason, duration: durationStr, deleteMessages } = parsed;

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:ban:error.notInServer"));
      return;
    }

    // §10.8: refuse moderating the bot itself or oneself.
    if (targetId === interaction.client?.user?.id) {
      await ctx.error(ctx.t("moderation:ban:error.cannotTargetBot"));
      return;
    }
    if (targetId === interaction.user.id) {
      await ctx.error(ctx.t("moderation:ban:error.cannotTargetSelf"));
      return;
    }

    let durationSec: number | undefined;
    if (durationStr) {
      try {
        durationSec = ModerationService.parseDuration(durationStr);
      } catch {
        await ctx.error(ctx.t("moderation:ban:error.invalidDuration"));
        return;
      }
    }
    const deleteMessageSeconds = DELETE_MESSAGE_SECONDS[deleteMessages ?? "none"] ?? 0;

    // A ban works by user ID, so the target does not need to be a guild member.
    const targetMember = guild.members.cache.get(targetId);
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
      await ctx.error(ctx.t("moderation:ban:error.hierarchy", { message: hierarchyErr }));
      return;
    }

    const service = new ModerationService({
      incrementCaseCounter,
      createCase,
      applyRepPenalty,
      getActiveWarnPoints,
      getLadderCasesInWindow,
    });

    // §10.3 Step 2: reserve an atomic case number before the Discord action.
    const caseNumber = await service.deps.incrementCaseCounter(guildId);

    // §10.3 Step 3: DM BEFORE the action — a ban removes the user from the server.
    await sendDm(ctx, guild, targetUser, cleanReason, durationSec, cfg);

    // §10.3 Step 4: perform the Discord action. On failure, do NOT create the case.
    try {
      await guild.bans.create(targetId, { deleteMessageSeconds, reason: cleanReason });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 50013
          ? ctx.t("moderation:ban:error.missingPermissions")
          : ctx.t("moderation:ban:error.actionFailed");
      await ctx.error(message);
      return;
    }

    // §10.3 Step 5: DB transaction — insert Case, apply rep penalty, update cleanSince.
    const created = await service.deps.createCase({
      guildId,
      type: durationSec ? "TEMPBAN" : "BAN",
      targetId,
      moderatorId: interaction.user.id,
      reason: cleanReason,
      durationSec,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await service.deps.applyRepPenalty(guildId, targetId, -100);

    // §10.3 Step 7: mod-log + save logMessageId.
    await sendModLog(ctx, guild, cfg, caseNumber, targetUser, interaction.user, cleanReason, durationSec);

    // §10.3 Step 9: reply with Undo / View case buttons.
    const durationSuffix = durationSec ? ` for ${formatDuration(durationSec)}` : "";
    const message = ctx.t("moderation:ban:success", {
      caseNumber,
      caseId: created.id,
      user: `<@${targetId}>`,
      duration: durationSuffix,
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "ban", "undo", String(caseNumber)))
        .setLabel("Undo")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(encodeId("mod", "ban", "view", String(caseNumber)))
        .setLabel("View case")
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: message, ephemeral: true, components: [row], allowedMentions: { parse: [] } });
  },
};
