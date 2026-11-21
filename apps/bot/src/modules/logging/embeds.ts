// Logging embed builders (§13.1).
// These build Discord embeds and attachments. service.ts stays pure.

import {
  EmbedBuilder,
  AttachmentBuilder,
  TextChannel,
} from "discord.js";
import type { EditLogData, DeleteLogData, BulkDeleteLogData } from "./service.js";
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
