import { GuildMember, TextChannel } from "discord.js";
import { client } from "../client.js";
import { getGuildLoggingConfig } from "../modules/logging/repository.js";
import {
  formatMemberLeave,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
} from "../modules/logging/service.js";
import { memberLeaveEmbed, sendLogMessage } from "../modules/logging/embeds.js";

export async function handleGuildMemberRemove(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const guildId = member.guild.id;

  const guildConfig = await getGuildLoggingConfig(guildId);
  if (!guildConfig) return;
  if (!shouldLogCategory(guildConfig, "members")) return;

  const logChannelId = resolveLogChannel(guildConfig, "members");
  if (!logChannelId) return;

  const roles = member.roles.cache.map((r) => r.id);
  if (shouldIgnore(guildConfig, "member-leave", member.id, roles, member.user.bot)) return;

  const logChannel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel || !logChannel.isTextBased()) return;

  const data = formatMemberLeave({
    guildId,
    userId: member.id,
    userTag: member.user.tag,
    userAvatarUrl: member.user.displayAvatarURL(),
    roles: roles.map((r) => `<@&${r}>`).join(", ") || "*(none)*",
    timestamp: Date.now(),
  });

  const embed = memberLeaveEmbed(data, (key: string) => key);

  await sendLogMessage(logChannel, embed);
}