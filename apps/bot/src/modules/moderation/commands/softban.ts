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
import { validateSoftBanInput } from "../schemas.js";
import { ModerationService } from "../service.js";
import {
  applyRepPenalty,
  createCase,
  getActiveWarnPoints,
  getLadderCasesInWindow,
  incrementCaseCounter,
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
    .setTitle(t("moderation:softban:dm.title"))
    .setDescription(t("moderation:softban:dm.body", {
      guild: guild?.name ?? "this server",
      reason,
      moderator: moderatorName(ctx.interaction as any, cfg),
    }))
    .setColor(COLORS.moderation.ban)
    .setTimestamp();
  try {
    await targetUser.send({ embeds: [embed] });
  } catch {
    // DMs may be closed; a softban removes the user from the server so we always DM first.
  }
}

export const softbanCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Softban a user (ban with 1 day message deletion, then unban).")
    .setDescriptionLocalizations(localizationsFor("softban"))
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to softban")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the softban")
        .setRequired(true)
        .setAutocomplete(true),
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

    const parsed = validateSoftBanInput({ user: targetUser.id, reason });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }
    const { user: targetId, reason: cleanReason } = parsed;

    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:softban:error.notInServer"));
      return;
    }

    if (targetId === interaction.client?.user?.id) {
      await ctx.error(ctx.t("moderation:softban:error.cannotTargetBot"));
      return;
    }
    if (targetId === interaction.user.id) {
      await ctx.error(ctx.t("moderation:softban:error.cannotTargetSelf"));
      return;
    }

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

    const hierarchyErr = checkHierarchy({
      targetIsGuildOwner: targetIsOwner,
      targetIsSelf,
      targetHighestRoleGeActor,
      targetHighestRoleGeBot,
      actorIsOwner,
    });
    if (hierarchyErr) {
      await ctx.error(ctx.t("moderation:softban:error.hierarchy", { message: hierarchyErr }));
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

    const caseNumber = await service.deps.incrementCaseCounter(guildId);

    // §10.3 Step 3: DM BEFORE the action — a softban removes the user from the server.
    await sendDm(ctx, guild, targetUser, cleanReason, cfg);

    try {
      await guild.bans.create(targetId, { deleteMessageSeconds: 86400, reason: cleanReason });
      await guild.bans.remove(targetId);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 50013
          ? ctx.t("moderation:softban:error.missingPermissions")
          : ctx.t("moderation:softban:error.actionFailed");
      await ctx.error(message);
      return;
    }

    const created = await service.deps.createCase({
      guildId,
      type: "SOFTBAN",
      targetId,
      moderatorId: interaction.user.id,
      reason: cleanReason,
      points: 0,
      caseNumber,
      automatic: false,
    });
    await service.deps.applyRepPenalty(guildId, targetId, -100);

    const message = ctx.t("moderation:softban:success", {
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
        .setCustomId(encodeId("mod", "softban", "view", String(caseNumber)))
        .setLabel("View case")
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: message, ephemeral: true, components: [row], allowedMentions: { parse: [] } });
  },
};
