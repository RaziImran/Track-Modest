import { GuildMember, TextChannel } from "discord.js";
import { client } from "../client.js";
import { getGuildLoggingConfig } from "../modules/logging/repository.js";
import {
  formatNicknameChange,
  formatAvatarChange,
  shouldIgnore,
  shouldLogCategory,
  resolveLogChannel,
} from "../modules/logging/service.js";
import { nicknameChangeEmbed, avatarChangeEmbed, sendLogMessage } from "../modules/logging/embeds.js";

export async function handleGuildMemberUpdate(
  oldMember: GuildMember,
  newMember: GuildMember,
): Promise<void> {
  if (newMember.user.bot) return;

  const guildId = newMember.guild.id;

  const guildConfig = await getGuildLoggingConfig(guildId);
  if (!guildConfig) return;
  if (!shouldLogCategory(guildConfig, "members")) return;

  const logChannelId = resolveLogChannel(guildConfig, "members");
  if (!logChannelId) return;

  const roles = newMember.roles.cache.map((r) => r.id);
  if (shouldIgnore(guildConfig, "member-update", newMember.id, roles, newMember.user.bot)) return;

  const logChannel = client.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel || !logChannel.isTextBased()) return;

  if (oldMember.nickname !== newMember.nickname) {
    const data = formatNicknameChange({
      guildId,
      userId: newMember.id,
      userTag: newMember.user.tag,
      userAvatarUrl: newMember.user.displayAvatarURL(),
      oldNickname: oldMember.nickname ?? "*(none)*",
      newNickname: newMember.nickname ?? "*(none)*",
      timestamp: Date.now(),
    });

    const embed = nicknameChangeEmbed(data, (key: string) => key);
    await sendLogMessage(logChannel, embed);
  }

  if (oldMember.user.avatar !== newMember.user.avatar) {
    const data = formatAvatarChange({
      guildId,
      userId: newMember.id,
      userTag: newMember.user.tag,
      userAvatarUrl: newMember.user.displayAvatarURL(),
      oldAvatarUrl: oldMember.user.displayAvatarURL({ forceStatic: false }),
      newAvatarUrl: newMember.user.displayAvatarURL({ forceStatic: false }),
      timestamp: Date.now(),
    });

    const embed = avatarChangeEmbed(data, (key: string) => key);
    await sendLogMessage(logChannel, embed);
  }
}