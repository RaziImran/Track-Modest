import { registerCommand } from "./core/commandRegistry.js";
import { pingCommand } from "./commands/ping.js";
import "./modules/moderation/index.js";
import "./modules/logging/index.js";
import "./modules/hub/index.js";
import "./events/messageUpdate.js";
import "./events/messageDelete.js";
import "./events/messageDeleteBulk.js";
import "./events/guildMemberAdd.js";
import "./events/guildMemberRemove.js";
import "./events/guildMemberUpdate.js";
import "./events/guildMemberRoleUpdate.js";
import "./events/guildChannelCreate.js";
import "./events/guildChannelDelete.js";
import "./events/guildChannelUpdate.js";
import "./events/guildVoiceStateUpdate.js";
import "./events/inviteCreate.js";
import "./events/inviteDelete.js";
import "./events/guildUpdate.js";
import "./events/guildEmojiUpdate.js";

registerCommand(pingCommand, import.meta.url);

export { client } from "./client.js";
