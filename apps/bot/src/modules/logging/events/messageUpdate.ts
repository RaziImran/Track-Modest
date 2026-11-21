import { Message, PartialMessage, TextChannel } from "discord.js";
import { client } from "../../../client.js";
import { getGuildLoggingConfig } from "../repository.js";
import {
  extractMessageData,
  getMessageUrl,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
} from "../service.js";
import { buildEditEmbed, sendLogMessage } from "../embeds.js";

export async function handleMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
): Promise<void> {
  if (!oldMessage.guild || !newMessage.guild) return;
  if (!oldMessage.author || !newMessage.author) return;
  if (oldMessage.author.bot || newMessage.author.bot) return;

  const guildId = oldMessage.guild.id;
  const channelId = oldMessage.channel.id;

  const guildConfig = await getGuildLoggingConfig(guildId);
  if (!guildConfig) return;
  if (!shouldLogCategory(guildConfig, "messages")) return;

  const logChannelId = resolveLogChannel(guildConfig, "messages");
  if (!logChannelId) return;

  const member = oldMessage.guild.members.cache.get(oldMessage.author.id);
  const roles = member?.roles.cache.map((r) => r.id) ?? [];

  if (shouldIgnore(guildConfig, channelId, oldMessage.author.id, roles, oldMessage.author.bot)) return;

  if (oldMessage.content === newMessage.content &&
      oldMessage.attachments.size === newMessage.attachments.size &&
      Array.from(oldMessage.attachments.values()).every((a) => newMessage.attachments.has(a.id))) {
    return;
  }

  const logChannel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel || !logChannel.isTextBased()) return;

  const oldData = extractMessageData({
    content: oldMessage.content ?? null,
    attachments: Array.from(oldMessage.attachments.values()).map((a) => ({
      name: a.name,
      url: a.url,
      size: a.size,
    })),
  }, true);
  const newData = extractMessageData({
    content: newMessage.content ?? null,
    attachments: Array.from(newMessage.attachments.values()).map((a) => ({
      name: a.name,
      url: a.url,
      size: a.size,
    })),
  }, true);

  const embed = buildEditEmbed(
    {
      guildId,
      channelId,
      authorId: oldMessage.author.id,
      authorTag: oldMessage.author.tag,
      authorAvatarUrl: oldMessage.author.displayAvatarURL(),
      beforeContent: oldData.content,
      afterContent: newData.content,
      beforeAttachments: oldData.attachments.map((a) => a.name),
      afterAttachments: newData.attachments.map((a) => a.name),
      messageUrl: getMessageUrl(guildId, channelId, oldMessage.id),
      timestamp: Date.now(),
    },
    (key: string) => key,
  );

  await sendLogMessage(logChannel, embed);
}
