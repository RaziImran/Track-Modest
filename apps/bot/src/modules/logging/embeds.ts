// Logging embed builders (§13.1).
// These build Discord embeds and attachments. service.ts stays pure.

import {
  EmbedBuilder,
  AttachmentBuilder,
  TextChannel,
} from "discord.js";
import type { EditLogData, DeleteLogData, BulkDeleteLogData, MemberJoinLogData, MemberLeaveLogData, NicknameChangeLogData, AvatarChangeLogData, RoleUpdateLogData, ChannelEventLogData, VoiceEventLogData, InviteEventLogData, GuildUpdateLogData, EmojiUpdateLogData } from "./service.js";
import { getCategoryColor, formatAttachments, formatContent, LOG_COLORS } from "./service.js";

export function buildEditEmbed(
  data: EditLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor("messages"))
    .setAuthor({ name: data.authorTag, iconURL: data.authorAvatarUrl ?? undefined })
    .setTitle(t("logging.edit.title"))
    .setDescription(t("logging.edit.description", { channel: `<#${data.channelId}>`, url: data.messageUrl }))
    .addFields(
      { name: t("logging.edit.before"), value: formatContent(data.beforeContent), inline: false },
      { name: t("logging.edit.after"), value: formatContent(data.afterContent), inline: false },
    )
    .setTimestamp(data.timestamp)
    .setFooter({ text: t("logging.edit.footer", { messageId: data.messageUrl.split("/").pop() ?? "unknown" }) });

  if (data.beforeAttachments.length > 0 || data.afterAttachments.length > 0) {
    embed.addFields({
      name: t("logging.edit.attachments"),
      value: t("logging.edit.attachmentsChanged", {
        before: data.beforeAttachments.length > 0 ? data.beforeAttachments.join(", ") : t("logging.none"),
        after: data.afterAttachments.length > 0 ? data.afterAttachments.join(", ") : t("logging.none"),
      }),
      inline: false,
    });
  }

  return embed;
}

export function buildDeleteEmbed(
  data: DeleteLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): EmbedBuilder {
  const color = data.wasCached ? getCategoryColor("messages") : LOG_COLORS.WARNING;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: data.authorTag, iconURL: data.authorAvatarUrl ?? undefined })
    .setTitle(t("logging.delete.title"))
    .setDescription(t("logging.delete.description", { channel: `<#${data.channelId}>`, url: data.messageUrl }))
    .addFields(
      { name: t("logging.delete.content"), value: formatContent(data.content), inline: false },
    );

  if (data.attachments.length > 0) {
    embed.addFields({
      name: t("logging.delete.attachments"),
      value: formatAttachments(data.attachments),
      inline: false,
    });
  }

  if (!data.wasCached) {
    embed.addFields({
      name: t("logging.delete.notCached"),
      value: t("logging.delete.contentUnavailable"),
      inline: false,
    });
  }

  embed.setTimestamp(data.timestamp).setFooter({ text: t("logging.delete.footer") });

  return embed;
}

export function buildBulkDeleteEmbed(
  data: BulkDeleteLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): { embed: EmbedBuilder; attachment: AttachmentBuilder } {
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor("messages"))
    .setTitle(t("logging.bulkDelete.title"))
    .setDescription(
      t("logging.bulkDelete.description", {
        channel: `<#${data.channelId}>`,
        count: data.messageCount,
      }),
    )
    .setTimestamp(data.timestamp)
    .setFooter({ text: t("logging.bulkDelete.footer") });

  const lines = data.messages.map((msg) => {
    const time = `<t:${Math.floor(msg.timestamp / 1000)}:T>`;
    const content = msg.content ? formatContent(msg.content, 200) : "*(no text)*";
    const attachments = msg.attachments.length > 0
      ? ` [${msg.attachments.map((a) => a.name).join(", ")}]`
      : "";
    return `${time} <@${msg.authorId}>: ${content}${attachments}`;
  });

  const fileContent = lines.join("\n");
  const attachment = new AttachmentBuilder(Buffer.from(fileContent, "utf-8"), {
    name: `bulk-delete-${data.channelId}-${data.timestamp}.txt`,
    description: t("logging.bulkDelete.attachmentDesc", { count: data.messageCount }),
  });

  return { embed, attachment };
}

export async function sendLogMessage(
  channel: TextChannel,
  embed: EmbedBuilder,
  attachment?: AttachmentBuilder,
): Promise<void> {
  const embedData = embed.toJSON();
  if (attachment) {
    await channel.send({ embeds: [embedData as any], files: [attachment], allowedMentions: { parse: [] } });
  } else {
    await channel.send({ embeds: [embedData as any], allowedMentions: { parse: [] } });
  }
}

export function memberJoinEmbed(
  data: MemberJoinLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor("members"))
    .setAuthor({ name: data.userTag, iconURL: data.userAvatarUrl ?? undefined })
    .setTitle(t("logging.members.join.title"))
    .setDescription(t("logging.members.join.description", { user: `<@${data.userId}>` }))
    .addFields(
      { name: t("logging.members.join.accountAge"), value: formatDuration(data.accountAge), inline: true },
      { name: t("logging.members.join.inviteUsed"), value: data.inviteUsed, inline: true },
    )
    .setTimestamp(data.timestamp)
    .setFooter({ text: t("logging.members.join.footer", { userId: data.userId }) });

  return embed;
}

export function memberLeaveEmbed(
  data: MemberLeaveLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor("members"))
    .setAuthor({ name: data.userTag, iconURL: data.userAvatarUrl ?? undefined })
    .setTitle(t("logging.members.leave.title"))
    .setDescription(t("logging.members.leave.description", { user: `<@${data.userId}>` }))
    .addFields(
      { name: t("logging.members.leave.roles"), value: data.roles, inline: false },
    )
    .setTimestamp(data.timestamp)
    .setFooter({ text: t("logging.members.leave.footer", { userId: data.userId }) });

  return embed;
}

export function nicknameChangeEmbed(
  data: NicknameChangeLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor("members"))
    .setAuthor({ name: data.userTag, iconURL: data.userAvatarUrl ?? undefined })
    .setTitle(t("logging.members.nickname.title"))
    .setDescription(t("logging.members.nickname.description", { user: `<@${data.userId}>` }))
    .addFields(
      { name: t("logging.members.nickname.before"), value: data.oldNickname, inline: true },
      { name: t("logging.members.nickname.after"), value: data.newNickname, inline: true },
    )
    .setTimestamp(data.timestamp)
    .setFooter({ text: t("logging.members.nickname.footer", { userId: data.userId }) });

  return embed;
}

export function avatarChangeEmbed(
  data: AvatarChangeLogData,
  t: (key: string, params?: Record<string, unknown>) => string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor("members"))
    .setAuthor({ name: data.userTag, iconURL: data.userAvatarUrl ?? undefined })
    .setTitle(t("logging.members.avatar.title"))
    .setDescription(t("logging.members.avatar.description", { user: `<@${data.userId}>` }))
    .setImage(data.newAvatarUrl ?? "")
    .setTimestamp(data.timestamp)
    .setFooter({ text: t("logging.members.avatar.footer", { userId: data.userId }) });

  return embed;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (years > 0) return `${years}y ${months % 12}mo`;
  if (months > 0) return `${months}mo ${days % 30}d`;
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function roleUpdateEmbed(data: RoleUpdateLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("roles")).setTitle(t("logging.roles.update.title")).setDescription(t("logging.roles.update.description", { user: `<@${data.userId}>` })).addFields({ name: t("logging.roles.update.added"), value: data.addedRoles.join(", ") || t("logging.none"), inline: true }, { name: t("logging.roles.update.removed"), value: data.removedRoles.join(", ") || t("logging.none"), inline: true }).setTimestamp(data.timestamp);
}
export function channelCreateEmbed(data: ChannelEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("channels")).setTitle(t("logging.channels.create.title")).setDescription(t("logging.channels.create.description", { channel: `<#${data.channelId}>` })).setTimestamp(data.timestamp);
}
export function channelDeleteEmbed(data: ChannelEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("channels")).setTitle(t("logging.channels.delete.title")).setDescription(t("logging.channels.delete.description", { name: data.channelName })).setTimestamp(data.timestamp);
}
export function channelUpdateEmbed(data: ChannelEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("channels")).setTitle(t("logging.channels.update.title")).setDescription(t("logging.channels.update.description", { channel: `<#${data.channelId}>` })).setTimestamp(data.timestamp);
}
export function voiceJoinEmbed(data: VoiceEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("voice")).setTitle(t("logging.voice.join.title")).setDescription(t("logging.voice.join.description", { user: `<@${data.userId}>`, channel: data.channelName })).setTimestamp(data.timestamp);
}
export function voiceLeaveEmbed(data: VoiceEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("voice")).setTitle(t("logging.voice.leave.title")).setDescription(t("logging.voice.leave.description", { user: `<@${data.userId}>`, channel: data.channelName })).setTimestamp(data.timestamp);
}
export function voiceMoveEmbed(data: VoiceEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("voice")).setTitle(t("logging.voice.move.title")).setDescription(t("logging.voice.move.description", { user: `<@${data.userId}>`, channel: data.channelName })).setTimestamp(data.timestamp);
}
export function voiceMuteEmbed(data: VoiceEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("voice")).setTitle(t("logging.voice.mute.title")).setDescription(t("logging.voice.mute.description", { user: `<@${data.userId}>` })).setTimestamp(data.timestamp);
}
export function voiceDeafenEmbed(data: VoiceEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("voice")).setTitle(t("logging.voice.deafen.title")).setDescription(t("logging.voice.deafen.description", { user: `<@${data.userId}>` })).setTimestamp(data.timestamp);
}
export function inviteCreateEmbed(data: InviteEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("invites")).setTitle(t("logging.invites.create.title")).setDescription(t("logging.invites.create.description", { code: data.code })).setTimestamp(data.timestamp);
}
export function inviteDeleteEmbed(data: InviteEventLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("invites")).setTitle(t("logging.invites.delete.title")).setDescription(t("logging.invites.delete.description", { code: data.code })).setTimestamp(data.timestamp);
}
export function guildUpdateEmbed(data: GuildUpdateLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("server")).setTitle(t("logging.server.update.title")).setDescription(data.changes.join("\n")).setTimestamp(data.timestamp);
}
export function emojiUpdateEmbed(data: EmojiUpdateLogData, t: (key: string, params?: Record<string, unknown>) => string): EmbedBuilder {
  return new EmbedBuilder().setColor(getCategoryColor("server")).setTitle(t("logging.emoji.update.title")).setDescription(data.changes.join("\n")).setTimestamp(data.timestamp);
}
