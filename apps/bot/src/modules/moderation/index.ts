import { registerCommand } from "../../core/commandRegistry.js";
import { warnCommand } from "./commands/warn.js";
import { timeoutCommand, untimeoutCommand } from "./commands/timeout.js";
import { kickCommand } from "./commands/kick.js";
import { banCommand } from "./commands/ban.js";
import { softbanCommand } from "./commands/softban.js";
import { unbanCommand } from "./commands/unban.js";
import { massbanCommand } from "./commands/massban.js";
import { purgeCommand } from "./commands/purge.js";
import { channelCommand } from "./commands/channel.js";
import { lockdownCommand } from "./commands/lockdown.js";
import { nickCommand } from "./commands/nick.js";
import {
  moderateUserCommand,
  moderateMessageCommand,
  reportMessageCommand,
  handleModalSubmit,
  showReasonModal,
} from "./commands/contextMenus.js";
import { client } from "../../client.js";
import { Events } from "discord.js";

registerCommand(warnCommand, import.meta.url);
registerCommand(timeoutCommand, import.meta.url);
registerCommand(untimeoutCommand, import.meta.url);
registerCommand(kickCommand, import.meta.url);
registerCommand(banCommand, import.meta.url);
registerCommand(softbanCommand, import.meta.url);
registerCommand(unbanCommand, import.meta.url);
registerCommand(massbanCommand, import.meta.url);
registerCommand(purgeCommand, import.meta.url);
registerCommand(channelCommand, import.meta.url);
registerCommand(lockdownCommand, import.meta.url);
registerCommand(nickCommand, import.meta.url);
registerCommand(moderateUserCommand, import.meta.url);
registerCommand(moderateMessageCommand, import.meta.url);
registerCommand(reportMessageCommand, import.meta.url);

// §MOD-09 Context menu button & modal handling
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("mod:context:")) return;

  const parts = customId.split(":");
  // mod:context:<action>:<targetId>:<moderatorId>
  const action = parts[2];
  const targetId = parts[3];
  const moderatorId = parts[4];

  if (!action || !targetId || !moderatorId) return;

  // Direct delete: no modal needed
  if (action === "delete") {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "This must be used in a server.", ephemeral: true });
      return;
    }
    try {
      await interaction.channel?.messages.delete(targetId);
      await interaction.reply({ content: "Message deleted.", ephemeral: true });
    } catch {
      await interaction.reply({ content: "Failed to delete message.", ephemeral: true });
    }
    return;
  }

  if (interaction.isButton()) {
    await showReasonModal(interaction, action, targetId, moderatorId);
    return;
  }

  if (interaction.isModalSubmit()) {
    const cfg = {};
    const t = (key: string) => key;
    await handleModalSubmit(interaction, cfg, t);
  }
});

export {
  warnCommand,
  timeoutCommand,
  untimeoutCommand,
  kickCommand,
  banCommand,
  softbanCommand,
  unbanCommand,
  massbanCommand,
  purgeCommand,
  channelCommand,
  lockdownCommand,
  nickCommand,
  moderateUserCommand,
  moderateMessageCommand,
  reportMessageCommand,
};
