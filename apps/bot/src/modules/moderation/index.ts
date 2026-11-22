import { registerCommand } from "../../core/commandRegistry.js";
import { warnCommand } from "./commands/warn.js";
import { timeoutCommand, untimeoutCommand } from "./commands/timeout.js";
import { kickCommand } from "./commands/kick.js";

registerCommand(warnCommand, import.meta.url);
registerCommand(timeoutCommand, import.meta.url);
registerCommand(untimeoutCommand, import.meta.url);
registerCommand(kickCommand, import.meta.url);

export { warnCommand, timeoutCommand, untimeoutCommand, kickCommand };