import { registerCommand } from "./core/commandRegistry.js";
import { pingCommand } from "./commands/ping.js";
import "./modules/moderation/index.js";

registerCommand(pingCommand, import.meta.url);

export { client } from "./client.js";
