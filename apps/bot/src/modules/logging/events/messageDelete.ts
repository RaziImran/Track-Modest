import { Message, PartialMessage, TextChannel } from "discord.js";
import { client } from "../../../client.js";
import { getGuildLoggingConfig } from "../repository.js";
import {
  extractMessageData,
  getMessageUrl,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
  detectGhostPing,
  shouldNotifyGhostPing,
} from "../service.js";
import { buildDeleteEmbed, buildGhostPingEmbed, sendLogMessage } from "../embeds.js";

export async function handleMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild) return;
  if (!message.author) return;
  if (message.author.bot) return;

  const guildId = message.guild.id;
  const channelId = message.channel.id;

  const guildConfig = await getGuildLoggingConfig(guildId);
  if (!guildConfig) return;
  if (!shouldLogCategory(guildConfig, "messages")) return;

  const logChannelId = resolveLogChannel(guildConfig, "messages");
  if (!logChannelId) return;

  const member = message.guild.members.cache.get(message.author.id);
  const roles = member?.roles.cache.map((r) => r.id) ?? [];

  if (shouldIgnore(guildConfig, channelId, message.author.id, roles, message.author.bot)) return;

  const wasCached = message.content !== null || message.attachments.size > 0;

  const logChannel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel || !logChannel.isTextBased()) return;

  const data = extractMessageData({
    content: message.content ?? null,
    attachments: Array.from(message.attachments.values()).map((a) => ({
      name: a.name,
      url: a.url,
      size: a.size,
    })),
  }, wasCached);

  // Detect ghost ping
  const mentionedUserIds = extractMentionedUserIds(message.content ?? "");
  const deleteTime = Date.now();
  const messageTime = message.createdTimestamp ?? deleteTime;
  const ghostPingResult = detectGhostPing(data.content, mentionedUserIds, messageTime, deleteTime);

  const embed = buildDeleteEmbed(
    {
      guildId,
      channelId,
      authorId: message.author.id,
      authorTag: message.author.tag,
      authorAvatarUrl: message.author.displayAvatarURL(),
      content: data.content,
      attachments: data.attachments,
      messageUrl: getMessageUrl(guildId, channelId, message.id),
      timestamp: Date.now(),
      wasCached,
    },
    (key: string) => key,
  );

  await sendLogMessage(logChannel, embed);

  // Send ghost ping notification if detected
  if (ghostPingResult.isGhostPing && shouldNotifyGhostPing(guildConfig)) {
    await sendGhostPingNotification(logChannel, {
      guildId,
      channelId,
      authorId: message.author.id,
      authorTag: message.author.tag,
      authorAvatarUrl: message.author.displayAvatarURL(),
      mentionedUserIds: ghostPingResult.mentionedUserIds,
      content: data.content,
      messageUrl: getMessageUrl(guildId, channelId, message.id),
      timestamp: Date.now(),
      deleteTime,
      timeToDelete: ghostPingResult.timeToDelete,
    });
  }
}

function extractMentionedUserIds(content: string): string[] {
  const mentionRegex = /<@!?(\d+)>/g;
  const matches = content.matchAll(mentionRegex);
  return Array.from(matches, (m) => m[1]).filter((id): id is string => id !== undefined);
}

async function sendGhostPingNotification(
  logChannel: TextChannel,
  ghostPingData: Parameters<typeof buildGhostPingEmbed>[0],
): Promise<void> {
  const embed = buildGhostPingEmbed(ghostPingData, (key: string) => key);
  await sendLogMessage(logChannel, embed);
}
