import { registerCommand } from "../../core/commandRegistry.js";
import { warnCommand } from "./commands/warn.js";

registerCommand(warnCommand, import.meta.url);

export { warnCommand };
