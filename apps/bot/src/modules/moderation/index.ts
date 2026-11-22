import { registerCommand } from "../../core/commandRegistry.js";
import { warnCommand } from "./commands/warn.js";
import { timeoutCommand, untimeoutCommand } from "./commands/timeout.js";

registerCommand(warnCommand, import.meta.url);
registerCommand(timeoutCommand, import.meta.url);
registerCommand(untimeoutCommand, import.meta.url);

export { warnCommand, timeoutCommand, untimeoutCommand };