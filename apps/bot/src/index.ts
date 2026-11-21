import { registerCommand } from "./core/commandRegistry.js";
import { pingCommand } from "./commands/ping.js";
import "./modules/moderation/index.js";
import "./modules/logging/index.js";
import "./events/messageUpdate.js";
import "./events/messageDelete.js";
import "./events/messageDeleteBulk.js";

registerCommand(pingCommand, import.meta.url);

export { client } from "./client.js";
