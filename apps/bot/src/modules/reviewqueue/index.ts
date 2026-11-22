// §15.2 Mod Review Queue — Discord event handlers and mod-queue posting.
// customId patterns:
//   review:claim:<itemId>
//   review:resolve:<itemId>:<resolution>  (approve|reject|ignore)
import { client } from "../../client.js";
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "@modest/db";
import { ReviewQueueRepository } from "./repository.js";
import { ReviewQueueService, type ReviewType } from "./service.js";

const repo = new ReviewQueueRepository({});
const service = new ReviewQueueService(ReviewQueueRepository.createServiceDeps(repo));

function getModQueueChannelId(): string | undefined {
  return (process.env["MOD_QUEUE_CHANNEL_ID"] as string | undefined);
}

export async function postToReviewQueue(input: {
  guildId: string;
  channelId: string;
  type: ReviewType;
  targetUserId?: string | null;
  targetUserTag?: string | null;
  evidence: unknown;
  aiExplanation?: string | null;
}): Promise<string | null> {
  const item = await service.createItem(input);
  const modQueueChannelId = getModQueueChannelId();
  if (!modQueueChannelId) return null;

  const guild = client.guilds.cache.get(input.guildId);
  if (!guild) return null;

  const channel = guild.channels.cache.get(modQueueChannelId);
  if (!channel || !channel.isTextBased()) return null;

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: "Type", value: item.type, inline: true },
    { name: "Status", value: item.status, inline: true },
  ];
  if (item.targetUserTag) {
    fields.push({ name: "Target", value: `<@${item.targetUserId}> (${item.targetUserTag})`, inline: true });
  }
  fields.push({ name: "Evidence", value: JSON.stringify(item.evidence).slice(0, 1024), inline: false });
  if (item.aiExplanation) {
    fields.push({ name: "AI suggestion (may be wrong)", value: item.aiExplanation.slice(0, 1024), inline: false });
  }

  const embed = new EmbedBuilder()
    .setTitle("Mod Review Queue Item")
    .setColor(0xFFA500)
    .setTimestamp()
    .addFields(fields);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`review:claim:${item.id}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`review:resolve:${item.id}:approve`).setLabel("Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`review:resolve:${item.id}:reject`).setLabel("Reject").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`review:resolve:${item.id}:ignore`).setLabel("Ignore").setStyle(ButtonStyle.Secondary),
  );

  try {
    const sent = await (channel as TextChannel).send({ embeds: [embed as any], components: [row] as any });
    await prisma.reviewItem.update({
      where: { id: BigInt(item.id) },
      data: { messageId: sent.id },
    });
    return sent.id;
  } catch {
    return null;
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("review:")) return;

  const parts = customId.split(":");
  // review:<action>:<itemId>[:<resolution>]
  const action = parts[1];
  const itemId = parts[2];
  const resolution = parts[3] as "approve" | "reject" | "ignore" | undefined;
  if (!action || !itemId) return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This must be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  if (action === "claim") {
    const claimed = await service.claimItem(itemId, interaction.user.id);
    if (!claimed) {
      await interaction.editReply({ content: "Item could not be claimed (already claimed or resolved)." });
      return;
    }
    await interaction.editReply({ content: `Claimed review item ${itemId}.` });

    // Update the original mod-queue message to show claimed status
    const items = await service.getPendingItems(guild.id);
    const item = items.find((i) => i.id === itemId);
    if (item?.messageId) {
      try {
        const channel = guild.channels.cache.get(item.channelId);
        if (channel?.isTextBased()) {
          const msg = await (channel as TextChannel).messages.fetch(item.messageId);
          if (msg) {
            await msg.edit({
              content: `**Claimed by** <@${interaction.user.id}>`,
            });
          }
        }
      } catch {
        // Message edit failed; continue
      }
    }
    return;
  }

  if (action === "resolve" && resolution) {
    const resolved = await service.resolveItem(itemId, resolution, interaction.user.id);
    if (!resolved) {
      await interaction.editReply({ content: "Item could not be resolved (already resolved)." });
      return;
    }
    await interaction.editReply({ content: `Resolved review item ${itemId} as ${resolution}.` });
    return;
  }

  await interaction.editReply({ content: "Unknown review action." });
});
