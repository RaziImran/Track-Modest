// §11 AutoMod — Discord event handler wiring.
// Listens to MessageCreate and runs the automod pipeline; executes actions via Discord API.
import { client } from "../../client.js";
import { Events, Message } from "discord.js";
import { registerCommand } from "../../core/commandRegistry.js";
import { AutomodRepository } from "./repository.js";
import { AutomodService } from "./service.js";
import { simulateCommand } from "./commands/simulate.js";
import { postToReviewQueue } from "../reviewqueue/index.js";

const repo = new AutomodRepository({ redisUrl: process.env["REDIS_URL"] ?? "" });
const service = new AutomodService(AutomodRepository.createServiceDeps(repo), {
  firstAction: "delete",
  timeoutSec: 600,
  spamMaxMessages: 5,
  spamWindowSec: 10,
  duplicateMaxRepeats: 3,
  mentionsMaxPerMessage: 5,
  mentionsMaxRolePerMessage: 3,
  emojiMaxPerMessage: 10,
  capsMaxPercent: 70,
  newlinesMax: 10,
  zalgoEnabled: true,
  badWordsLevel: "standard",
  linksMode: "allowlist",
  invitesMode: "block",
  phishingEnabled: true,
  publicNotice: true,
  useNative: false,
  aiEnabled: false, // AM-12: enabled when AI module wiring is complete
  mediaScanEnabled: false, // AM-13: enabled when vision model wiring is complete
});

registerCommand(simulateCommand, import.meta.url);

// Placeholder AI/media classification deps — wired to the AI module when implemented (AI-01…).
// Until then, these return null, causing checks 11–12 to skip silently (§11.6, §11.7).
const aiClassify = async (): Promise<{ category: string; severity: number; explanation: string } | null> => null;
const mediaClassify = async (): Promise<Array<{ category: "nsfw" | "gore" | "scam_qr" | "none"; confidence: number }>> => [];

const serviceWithDeps = new AutomodService(
  AutomodRepository.createServiceDeps(repo),
  service.config,
);
serviceWithDeps.deps.aiClassify = aiClassify;
serviceWithDeps.deps.mediaClassify = mediaClassify;

function resolveConfigOverrides(_cfg: any): Partial<AutomodService["config"]> {
  // In the future, read automod.* overrides from ctx.config / guildConfig.
  // For now defaults are used; this hook keeps the wiring in place.
  return {};
}

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Resolve per-guild config overrides (placeholder — wired to settings later)
  const overrides = resolveConfigOverrides(message.guild);
  const deps = AutomodRepository.createServiceDeps(repo);
  deps.aiClassify = aiClassify;
  deps.mediaClassify = mediaClassify;
  const svc = new AutomodService(
    deps,
    { ...serviceWithDeps.config, ...overrides } as any,
  );

  const isStaff = await isStaffMember(message.guild, message.author.id);
  const memberRoles = message.member ? (message.member.roles.cache.map((r) => r.id) as string[]) : [];
  const channel = message.channel;
  const channelIsNsfw = channel.isTextBased() ? (channel as any).isNSFW() : false;

  const input = {
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id,
    memberId: message.member?.id ?? message.author.id,
    authorId: message.author.id,
    content: message.content,
    memberRoles,
    isBot: message.author.bot,
    isStaff,
    embedUrls: message.embeds.map((e) => e.url ?? "").filter(Boolean),
    attachmentCount: message.attachments.size,
    attachments: Array.from(message.attachments.values()).map((a) => ({
      filename: a.name,
      size: a.size,
      contentType: a.contentType ?? undefined,
    })),
    mentionedUserIds: Array.from(message.mentions.users.keys()),
    mentionedRoleIds: Array.from(message.mentions.roles.keys()),
    mentionEveryone: message.mentions.everyone,
    mentionHere: false, // discord.js v14 doesn't expose @here directly; content scan fallback
    messageId: message.id,
    timestamp: message.createdAt,
    channelIsNsfw,
    replyChainPriorHits: false,
  };

  const response = await svc.handleMessage(input);
  if (response.action === "none" && !response.shouldPostToReviewQueue) return;

  // Execute the action
  try {
    if (response.shouldDelete) {
      await message.delete().catch(() => {
        // Message may already be deleted or permissions missing
      });
    }

    // Public notice (auto-deletes after 8 seconds) — skip for AI review (never auto-punish from AI)
    if (
      response.shouldLog &&
      service.config.publicNotice &&
      message.channel.isTextBased() &&
      response.action !== "alert"
    ) {
      const notice = await (message.channel as any).send(
        `🛡️ <@${input.userId}>, your message was removed: ${response.reason}.`,
      );
      globalThis.setTimeout(() => notice.delete().catch(() => {}), 8000).unref();
    }

    // Log the hit
    await svc.deps.recordAutomodHit({
      guildId: input.guildId,
      userId: input.userId,
      channelId: input.channelId,
      ruleKey: response.ruleKey,
      action: response.action,
      shadow: response.shadow,
    });

    // DM the user with explanation (best effort) — skip for AI review (mods handle it via review queue)
    if (response.shouldDm) {
      try {
        await message.author.send(
          `Your message in **${message.guild.name}** was removed by AutoMod: ${response.reason}.\n` +
            "If you think this is a mistake, contact the moderators.",
        ).catch(() => {
          // DMs may be closed
        });
      } catch {
        // DM failed; continue
      }
    }

    // Post to Mod Review Queue (AM-12/AM-13)
    if (response.shouldPostToReviewQueue) {
      await postToReviewQueue({
        guildId: input.guildId,
        channelId: input.channelId,
        type: response.reviewType ?? "automod_ai",
        targetUserId: input.userId,
        targetUserTag: message.author.tag,
        evidence: response.reviewEvidence ?? response.details ?? {},
        aiExplanation: response.reviewAiExplanation ?? null,
      });
    }

    // Repeat escalation (skip when no action was taken)
    if (response.action !== "none") {
      const { escalated } = await svc.applyEscalation(input, response.action);
      if (escalated) {
        // Could escalate to timeout/kick/ban here via Discord API
        // For now, record the escalation in the hit details
      }
    }
  } catch {
    // Action execution failed; do not crash the message handler
  }
});

async function isStaffMember(guild: any, userId: string): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId);
    // Staff = has any moderation-related permission or a role named like staff/mod/admin
    const permissions = member.permissions;
    if (permissions.has("KickMembers") || permissions.has("BanMembers") || permissions.has("ManageMessages")) return true;
    return member.roles.cache.some((r: any) => /staff|mod|admin/i.test(r.name));
  } catch {
    return false;
  }
}
