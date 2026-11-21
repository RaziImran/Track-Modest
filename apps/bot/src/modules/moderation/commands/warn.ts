import { SlashCommandBuilder } from "discord.js";
import type { BotCommand, CommandContext } from "@modest/shared";
import { validateWarnInput } from "../schemas.js";
import { ModerationService } from "../service.js";
import {
  incrementCaseCounter,
  createCase,
  addRepPoints,
  getActiveWarnPoints,
  getLadderCasesInWindow,
} from "../repository.js";

export const warnCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member and add reputation points.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Member to warn").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the warning").setRequired(true).setAutocomplete(true),
    )
    .addIntegerOption((opt) =>
      opt.setName("points").setDescription("Warning points (1-5)").setMinValue(1).setMaxValue(5),
    )
    .addBooleanOption((opt) => opt.setName("silent").setDescription("Do not DM the user")),
  module: "moderation",
  staffLevel: "helper",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const pointsOpt = interaction.options.getInteger("points");
    const silentOpt = interaction.options.getBoolean("silent");

    const parsed = validateWarnInput({
      user: user.id,
      reason,
      points: pointsOpt ?? 1,
      silent: silentOpt ?? false,
    });
    if ("error" in parsed) {
      await ctx.error(parsed.error);
      return;
    }

    const { user: targetId, reason: cleanReason, points: cleanPoints } = parsed;

    const service = new ModerationService({
      incrementCaseCounter: (gid: string) => incrementCaseCounter(gid),
      createCase: (input: any) => createCase(input),
      addRepPoints: (gid: string, uid: string, delta: number) => addRepPoints(gid, uid, delta),
      getActiveWarnPoints: (gid: string, uid: string, days: number) => getActiveWarnPoints(gid, uid, days),
      getLadderCasesInWindow: (gid: string, uid: string, pts: number, days: number) =>
        getLadderCasesInWindow(gid, uid, pts, days),
    });

    // §10.3 Step 2: case created with atomic numbering
    const result = await service.applyWarn((ctx.config as any).guildId, targetId, interaction.user.id, cleanReason, cleanPoints);

    // §10.3 Step 5: apply rep penalty (negative points)
    await service.deps.addRepPoints((ctx.config as any).guildId, targetId, -cleanPoints);

    // §10.6: check escalation ladder
    const strictness = ((ctx.config as any)?.strictness ?? "BALANCED") as any;
    const expiryDays = 30;
    const activePoints = await service.deps.getActiveWarnPoints((ctx.config as any).guildId, targetId, expiryDays);
    const ladder = ModerationService.getDefaultLadder(strictness);
    const escalation = await service.checkEscalation((ctx.config as any).guildId, targetId, activePoints, ladder, expiryDays);

    let replyMsg = `Case #${result.caseNumber} — <@${targetId}> was warned. Points: ${cleanPoints}. Total active: ${activePoints}.`;
    if (escalation) {
      replyMsg += `\nEscalation: ${escalation.action} at ${escalation.points} points.`;
    }

    await ctx.success(replyMsg);
  },
};
