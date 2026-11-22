import { registerCommand } from "../../core/commandRegistry.js";
import { menuCommand } from "./commands/menu.js";

registerCommand(menuCommand, import.meta.url);

export { menuCommand };
export * from "./schemas.js";
export {
  buildHubView,
  computeRedDots,
  resolveVisibleActions,
  buildHubButtons,
  buttonCustomId,
  chunk,
  HUB_ACTION_DEFS,
  RED_DOT,
} from "./service.js";
export type {
  HubButtonStyle,
  HubField,
  HubButton,
  HubViewModel,
  HubViewModelInput,
  HubActionDef,
} from "./service.js";