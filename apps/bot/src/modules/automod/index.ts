// §11 AutoMod — Discord event handler wiring.
// Listens to MessageCreate and runs the automod pipeline; executes actions via Discord API.
import { client } from "../../client.js";
import { Events, Message } from "discord.js";
import { AutomodRepository } from "./repository.js";
import { AutomodService } from "./service.js";

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
});

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
  const serviceWithOverrides = new AutomodService(
    AutomodRepository.createServiceDeps(repo),
    { ...service.config, ...overrides } as any,
  );

  const isStaff = await isStaffMember(message.guild, message.author.id);
  const memberRoles = message.member ? (message.member.roles.cache.map((r) => r.id) as string[]) : [];

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
  };

  const response = await serviceWithOverrides.handleMessage(input);
  if (response.action === "none") return;

  // Execute the action
  try {
    if (response.shouldDelete) {
      await message.delete().catch(() => {
        // Message may already be deleted or permissions missing
      });
    }

    // Public notice (auto-deletes after 8 seconds)
    if (response.shouldLog && service.config.publicNotice && message.channel.isTextBased()) {
      const notice = await (message.channel as any).send(
        `🛡️ <@${input.userId}>, your message was removed: ${response.reason}.`,
      );
      globalThis.setTimeout(() => notice.delete().catch(() => {}), 8000).unref();
    }

    // Log the hit
    await service.deps.recordAutomodHit({
      guildId: input.guildId,
      userId: input.userId,
      channelId: input.channelId,
      ruleKey: response.ruleKey,
      action: response.action,
      shadow: response.shadow,
    });

    // DM the user with explanation (best effort)
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

    // Repeat escalation
    const { escalated } = await serviceWithOverrides.applyEscalation(input, response.action);
    if (escalated) {
      // Could escalate to timeout/kick/ban here via Discord API
      // For now, record the escalation in the hit details
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
