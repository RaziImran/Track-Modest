import { GuildMember, TextChannel } from "discord.js";
import { client } from "../client.js";
import { getGuildLoggingConfig } from "../modules/logging/repository.js";
import {
  formatMemberJoin,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
} from "../modules/logging/service.js";
import { memberJoinEmbed, sendLogMessage } from "../modules/logging/embeds.js";

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const guildId = member.guild.id;

  const guildConfig = await getGuildLoggingConfig(guildId);
  if (!guildConfig) return;
  if (!shouldLogCategory(guildConfig, "members")) return;

  const logChannelId = resolveLogChannel(guildConfig, "members");
  if (!logChannelId) return;

  const roles = member.roles.cache.map((r) => r.id);
  if (shouldIgnore(guildConfig, "member-join", member.id, roles, member.user.bot)) return;

  const logChannel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel || !logChannel.isTextBased()) return;

  const accountAge = Date.now() - member.user.createdTimestamp;
  const inviteUsed = "Unknown";

  const data = formatMemberJoin({
    guildId,
    userId: member.id,
    userTag: member.user.tag,
    userAvatarUrl: member.user.displayAvatarURL(),
    accountAge,
    inviteUsed,
    timestamp: Date.now(),
  });

  const embed = memberJoinEmbed(data, (key: string) => key);

  await sendLogMessage(logChannel, embed);
}