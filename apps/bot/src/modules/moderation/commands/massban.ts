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
import { validateMassBanInput } from "../schemas.js";
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

async function sendDm(
  ctx: CommandContext,
  guild: any,
  targetUser: any,
  reason: string,
  cfg: any,
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:massban:dm.title"))
    .setDescription(
      t("moderation:massban:dm.body", {
        guild: guild?.name ?? "this server",
        reason,
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
): Promise<void> {
  const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
  const modLogChannelId =
    (getCfg(cfg, "modLogChannelId", undefined) as string | undefined) ??
    ((getCfg(cfg, "logChannels", undefined) as Record<string, string> | undefined)?.["modLog"]);
  if (!modLogChannelId || !guild) return;
  const channel = guild.channels.cache.get(modLogChannelId);
  if (!channel?.isText()) return;
  const embed = new EmbedBuilder()
    .setTitle(t("moderation:massban:modlog.title"))
    .setDescription(
      t("moderation:massban:modlog.body", {
        case: caseNumber,
        target: `<@${targetUser.id}>`,
        moderator: `<@${moderator.id}>`,
        reason,
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

const BATCH_SIZE = 100;

export const massbanCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("massban")
    .setDescription("Ban multiple users at once (admin only).")
    .setDescriptionLocalizations(localizationsFor("massban"))
    .addStringOption((opt) =>
      opt
        .setName("users")
        .setDescription("Users to ban (mentions or IDs, separated by spaces, commas, or newlines; max 200)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the mass ban")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  module: "moderation",
  staffLevel: "admin",
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

    const usersInput = interaction.options.getString("users", true);
    const reason = interaction.options.getString("reason", true);

    const parsed = validateMassBanInput({ users: usersInput, reason });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { userIds: targetIds, reason: cleanReason } = parsed;

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:massban:error.notInServer"));
      return;
    }

    // §10.8: refuse moderating the bot itself or oneself.
    const botId = interaction.client?.user?.id;
    const actorId = interaction.user.id;
    const filteredTargetIds = targetIds.filter((id) => id !== botId && id !== actorId);
    const removedSelf = targetIds.length - filteredTargetIds.length;
    if (removedSelf > 0) {
      await ctx.error(ctx.t("moderation:massban:error.removedSelfBot", { count: removedSelf }));
      return;
    }
    if (filteredTargetIds.length === 0) {
      await ctx.error(ctx.t("moderation:massban:error.noValidTargets"));
      return;
    }

    const botMember = guild.members.cache.get(botId);
    const actorIsOwner = actorId === guild?.ownerId;
    const actorHighest = (interaction.member as any)?.roles?.highest;
    const botHighest = botMember?.roles.highest;

    // Check hierarchy for all targets that are members
    const targetMembers = await Promise.all(
      filteredTargetIds.map((id) => guild.members.fetch(id).catch(() => null)),
    );
    for (const targetMember of targetMembers) {
      if (!targetMember) continue;
      const targetIsOwner = targetMember.id === guild?.ownerId;
      const targetIsSelf = targetMember.id === actorId;
      const targetHighest = targetMember.roles.highest;
      const targetHighestRoleGeActor = Boolean(targetHighest && actorHighest && targetHighest.comparePosition(actorHighest) >= 0);
      const targetHighestRoleGeBot = Boolean(targetHighest && botHighest && targetHighest.comparePosition(botHighest) >= 0);

      const hierarchyErr = checkHierarchy({
        targetIsGuildOwner: targetIsOwner,
        targetIsSelf,
        targetHighestRoleGeActor,
        targetHighestRoleGeBot,
        actorIsOwner,
      });
      if (hierarchyErr) {
        await ctx.error(ctx.t("moderation:massban:error.hierarchy", { message: hierarchyErr, user: `<@${targetMember.id}>` }));
        return;
      }
    }

    // Confirm before proceeding
    const confirmMessage = ctx.t("moderation:massban:confirm", { count: filteredTargetIds.length });
    const confirmed = await ctx.confirm(confirmMessage);
    if (!confirmed) {
      await ctx.error(ctx.t("moderation:massban:cancelled"));
      return;
    }

    // Batch ban users
    const bannedIds: string[] = [];
    const failedIds: string[] = [];

    for (let i = 0; i < filteredTargetIds.length; i += BATCH_SIZE) {
      const batch = filteredTargetIds.slice(i, i + BATCH_SIZE);
      try {
        await guild.members.bulkBan(batch, { reason: cleanReason });
        bannedIds.push(...batch);
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code === 50013) {
          await ctx.error(ctx.t("moderation:massban:error.missingPermissions"));
          return;
        }
        // If bulk ban fails partially, fall back to individual bans for this batch
        for (const targetId of batch) {
          try {
            await guild.bans.create(targetId, { reason: cleanReason });
            bannedIds.push(targetId);
          } catch {
            failedIds.push(targetId);
          }
        }
      }
    }

    if (bannedIds.length === 0) {
      await ctx.error(ctx.t("moderation:massban:error.allFailed"));
      return;
    }

    // DM banned users before creating cases (best effort)
    const targetUsers = await Promise.all(
      bannedIds.map((id) => interaction.client.users.fetch(id).catch(() => null)),
    );
    for (const targetUser of targetUsers) {
      if (targetUser) {
        await sendDm(ctx, guild, targetUser, cleanReason, cfg);
      }
    }

    // Create cases and apply rep penalties
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

    const result = await service.applyMassBan(guildId, bannedIds, actorId, cleanReason);

    // Send mod-log for each banned user
    for (let i = 0; i < result.bannedUserIds.length; i++) {
      const targetId = result.bannedUserIds[i];
      const caseNumber = result.caseNumbers[i]!;
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => ({ id: targetId, username: "Unknown" }));
      await sendModLog(ctx, guild, cfg, caseNumber, targetUser, interaction.user, cleanReason);
    }

    // Reply with summary
    const successCount = result.bannedUserIds.length;
    const failCount = result.failedUserIds.length + (targetIds.length - filteredTargetIds.length);
    const message = ctx.t("moderation:massban:success", {
      successCount,
      failCount,
      caseNumbers: result.caseNumbers.join(", "),
    });

    const firstCaseNumber = result.caseNumbers[0];
    const components = firstCaseNumber !== undefined
      ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(encodeId("mod", "massban", "view", firstCaseNumber.toString()))
            .setLabel("View first case")
            .setStyle(ButtonStyle.Secondary),
        )]
      : [];

    await interaction.reply({ content: message, ephemeral: true, components, allowedMentions: { parse: [] } });
  },
};