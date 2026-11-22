import { registerCommand } from "../../core/commandRegistry.js";
import { warnCommand } from "./commands/warn.js";
import { timeoutCommand, untimeoutCommand } from "./commands/timeout.js";
import { kickCommand } from "./commands/kick.js";
import { banCommand } from "./commands/ban.js";
import { softbanCommand } from "./commands/softban.js";
import { unbanCommand } from "./commands/unban.js";
import { massbanCommand } from "./commands/massban.js";
import { purgeCommand } from "./commands/purge.js";

registerCommand(warnCommand, import.meta.url);
registerCommand(timeoutCommand, import.meta.url);
registerCommand(untimeoutCommand, import.meta.url);
registerCommand(kickCommand, import.meta.url);
registerCommand(banCommand, import.meta.url);
registerCommand(softbanCommand, import.meta.url);
registerCommand(unbanCommand, import.meta.url);
registerCommand(massbanCommand, import.meta.url);
registerCommand(purgeCommand, import.meta.url);

export { warnCommand, timeoutCommand, untimeoutCommand, kickCommand, banCommand, softbanCommand, unbanCommand, massbanCommand, purgeCommand };
