import { registerCommand } from "../../core/commandRegistry.js";
import { strictnessCommand } from "./commands/strictness.js";

registerCommand(strictnessCommand, import.meta.url);

export { strictnessCommand };
