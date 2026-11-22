// §15.4 Shadow mode — Discord event handlers and shadow-log posting.
// customId patterns:
//   shadowmode:enable:<ruleId>
//   shadowmode:extend:<ruleId>
//   shadowmode:discard:<ruleId>
import { client } from "../../client.js";
import { Events, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "@modest/db";
import { ShadowModeRepository } from "./repository.js";
import { ShadowModeService } from "./service.js";

const repo = new ShadowModeRepository({});
const service = new ShadowModeService(ShadowModeRepository.createServiceDeps(repo));

function getShadowChannelId(_guildId: string): string | undefined {
  return (process.env["AUTOMOD_SHADOW_CHANNEL_ID"] as string | undefined);
}

export async function postShadowHit(input: {
  guildId: string;
  ruleId: number;
  ruleName: string;
  userId: string;
  userTag: string;
  channelId: string;
  messageId: string;
  content: string;
  isFalsePositive: boolean;
}): Promise<void> {
  await service.recordShadowHit({
    guildId: input.guildId,
    ruleId: input.ruleId,
    ruleName: input.ruleName,
    isFalsePositive: input.isFalsePositive,
  });

  const shadowChannelId = getShadowChannelId(input.guildId);
  if (!shadowChannelId) return;

  const guild = client.guilds.cache.get(input.guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(shadowChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("👥 Automod Shadow Hit")
    .setColor(0xFFA500)
    .setTimestamp()
    .addFields(
      { name: "Rule", value: input.ruleName, inline: true },
      { name: "User", value: `<@${input.userId}> (${input.userTag})`, inline: true },
      { name: "Channel", value: `<#${input.channelId}>`, inline: true },
      { name: "Message", value: input.content.slice(0, 1024), inline: false },
      { name: "Action", value: "Logged only (shadow mode — no action taken)", inline: false },
    );

  try {
    await (channel as TextChannel).send({ embeds: [embed as any] });
  } catch {
    // Post failed; continue
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("shadowmode:")) return;

  const parts = customId.split(":");
  // shadowmode:<action>:<ruleId>
  const action = parts[1];
  const ruleId = Number(parts[2]);
  if (!action || !ruleId) return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This must be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const rule = await prisma.automodRule.findUnique({
    where: { id: ruleId },
  });
  if (!rule || rule.guildId !== guild.id) {
    await interaction.editReply({ content: "Rule not found or not in this server." });
    return;
  }

  if (action === "enable") {
    await service.enableShadow(guild.id, ruleId, 7);
    await interaction.editReply({ content: `Shadow mode enabled for rule "${rule.name}" (7 days).` });
    return;
  }

  if (action === "extend") {
    // Extend by another 7 days from now
    const now = new Date();
    const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.automodRule.update({
      where: { id: ruleId },
      data: {
        shadow: true,
        shadowStartedAt: now,
        shadowUntil: until,
      },
    });
    await interaction.editReply({ content: `Shadow mode extended for rule "${rule.name}" (7 more days).` });
    return;
  }

  if (action === "discard") {
    await service.disableShadow(guild.id, ruleId);
    await interaction.editReply({ content: `Shadow mode disabled for rule "${rule.name}".` });
    return;
  }

  await interaction.editReply({ content: "Unknown shadow mode action." });
});
