import { Message, PartialMessage, ReadonlyCollection, TextChannel } from "discord.js";
import { client } from "../../../client.js";
import { getGuildLoggingConfig } from "../repository.js";
import {
  extractMessageData,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
} from "../service.js";
import { buildBulkDeleteEmbed, sendLogMessage } from "../embeds.js";

export async function handleMessageDeleteBulk(messages: ReadonlyCollection<string, Message | PartialMessage>): Promise<void> {
  const firstMessage = messages.first();
  if (!firstMessage || !firstMessage.guild) return;

  const guildId = firstMessage.guild.id;
  const channelId = firstMessage.channel.id;

  const guildConfig = await getGuildLoggingConfig(guildId);
  if (!guildConfig) return;
  if (!shouldLogCategory(guildConfig, "messages")) return;

  const logChannelId = resolveLogChannel(guildConfig, "messages");
  if (!logChannelId) return;

  const member = firstMessage.guild.members.cache.get(firstMessage.author?.id ?? "");
  const roles = member?.roles.cache.map((r) => r.id) ?? [];

  if (firstMessage.author && shouldIgnore(guildConfig, channelId, firstMessage.author.id, roles, firstMessage.author.bot)) return;

  const logChannel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel || !logChannel.isTextBased()) return;

  const messageArray = messages
    .filter((m) => m.author && !m.author.bot)
    .map((m) => {
      const data = extractMessageData({
        content: m.content ?? null,
        attachments: Array.from(m.attachments.values()).map((a) => ({
          name: a.name,
          url: a.url,
          size: a.size,
        })),
      }, true);
      return {
        authorId: m.author!.id,
        authorTag: m.author!.tag,
        content: data.content,
        attachments: data.attachments,
        timestamp: m.createdTimestamp,
      };
    });

  if (messageArray.length === 0) return;

  const { embed, attachment } = buildBulkDeleteEmbed(
    {
      guildId,
      channelId,
      messageCount: messageArray.length,
      messages: messageArray,
      timestamp: Date.now(),
    },
    (key: string) => key,
  );

  await sendLogMessage(logChannel, embed, attachment);
}
