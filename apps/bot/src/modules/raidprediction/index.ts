// §15.3 Raid prediction — Discord event handlers and warning posting.
// customId patterns:
//   raidprediction:start_lockdown:<guildId>
//   raidprediction:ban_accounts:<guildId>
//   raidprediction:ignore:<guildId>
import { client } from "../../client.js";
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "@modest/db";
import { RaidPredictionRepository } from "./repository.js";
import { detectCoordinatedJoins, parseConfig, type JoinRecord } from "./service.js";

const repo = new RaidPredictionRepository({ redisUrl: process.env["REDIS_URL"] });

function getModQueueChannelId(): string | undefined {
  return (process.env["MOD_QUEUE_CHANNEL_ID"] as string | undefined);
}

export async function handleGuildMemberAddRaidPrediction(member: any): Promise<void> {
  if (member.user.bot) return;

  const guildId = member.guild.id;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return;

  const configRow = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true },
  });
  const overrides = (configRow?.overrides as Record<string, unknown> | undefined) ?? {};
  const config = parseConfig(overrides);

  // Record this join
  await repo.recordJoin(
    guildId,
    member.id,
    member.user.username,
    member.user.avatar,
    new Date(),
  );

  // Get recent joins for prediction
  const recent = await repo.getRecentJoins(guildId, config.timeWindowSec);

  const joinRecords: JoinRecord[] = recent.map((j) => ({
    userId: j.userId,
    username: j.username,
    avatarHash: j.avatarHash,
    accountCreatedAt: new Date(), // We don't have account creation time from Redis; approximate
    joinedAt: j.joinedAt,
  }));

  // Note: We need account creation time for age-based detection.
  // Since Redis doesn't store it, fetch member's user created timestamp.
  // For simplicity, we check all recent joins' account ages against the window.
  const enriched: JoinRecord[] = [];
  for (const j of joinRecords) {
    try {
      const user = await client.users.fetch(j.userId);
      enriched.push({ ...j, accountCreatedAt: user.createdAt });
    } catch {
      enriched.push(j);
    }
  }

  const result = detectCoordinatedJoins(enriched, config);
  if (!result.predicted) return;

  // §15.3 Post Raid warning (no automatic action unless profile is Lockdown)
  const modQueueChannelId = getModQueueChannelId();
  if (!modQueueChannelId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(modQueueChannelId);
  if (!channel || !channel.isTextBased()) return;

  const reasonLabels = {
    coordinated_age: "accounts created within the same 30-minute window",
    coordinated_name: "similar usernames",
    coordinated_avatar: "identical avatars",
  };

  const embed = new EmbedBuilder()
    .setTitle("🚨 Raid Prediction Warning")
    .setColor(0xFFA500)
    .setTimestamp()
    .addFields(
      { name: "Reason", value: `Coordinated joins detected (${reasonLabels[result.reason!]})`, inline: false },
      { name: "Count", value: `${result.joiners.length} accounts`, inline: true },
      { name: "Action", value: "No automatic action — manual review required", inline: true },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`raidprediction:start_lockdown:${guildId}`).setLabel("Start lockdown").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`raidprediction:ban_accounts:${guildId}`).setLabel("Ban these accounts").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`raidprediction:ignore:${guildId}`).setLabel("Ignore").setStyle(ButtonStyle.Secondary),
  );

  try {
    await (channel as TextChannel).send({ embeds: [embed as any], components: [row] as any });
  } catch {
    // Post failed; continue
  }
}

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;
  await handleGuildMemberAddRaidPrediction(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("raidprediction:")) return;

  const parts = customId.split(":");
  // raidprediction:<action>:<guildId>
  const action = parts[1];
  const guildId = parts[2];
  if (!action || !guildId) return;

  const guild = interaction.guild;
  if (!guild || guild.id !== guildId) {
    await interaction.reply({ content: "This button is not valid for this server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  switch (action) {
    case "start_lockdown": {
      try {
        await guild.setVerificationLevel(4); // Very High
        await interaction.editReply({ content: "Lockdown started. Verification level set to Very High." });
      } catch {
        await interaction.editReply({ content: "Failed to start lockdown." });
      }
      break;
    }

    case "ban_accounts": {
      // Ban the recently joined suspicious accounts
      const recent = await repo.getRecentJoins(guildId, 300); // last 5 minutes
      let banned = 0;
      for (const j of recent) {
        try {
          await guild.bans.create(j.userId, { reason: "Raid prediction: coordinated account" });
          banned += 1;
        } catch {
          // Ban failed; continue
        }
      }
      await interaction.editReply({ content: `Banned ${banned} account(s).` });
      break;
    }

    case "ignore": {
      await interaction.editReply({ content: "Raid prediction warning ignored." });
      break;
    }

    default:
      await interaction.editReply({ content: "Unknown raid prediction action." });
  }
});
