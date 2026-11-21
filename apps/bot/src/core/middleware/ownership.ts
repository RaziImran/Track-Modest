import { decodeId } from "../componentIds.js";

const MAX_CUSTOM_ID = 100;

export function embedOwnerId(customId: string, ownerId: string): string {
  const result = `${customId}:${ownerId}`;
  if (result.length > MAX_CUSTOM_ID) {
    throw new Error(`customId exceeds ${MAX_CUSTOM_ID} chars`);
  }
  return result;
}

export function checkOwnership(customId: string, callerId: string): boolean {
  const decoded = decodeId(customId);
  const ownerId = decoded.args[decoded.args.length - 1];
  if (!ownerId) return false;
  return ownerId === callerId;
}

export function recheckPermission(
  interaction: { guildId?: string | null; member?: { permissions?: { has: (perm: string) => boolean } } },
  requiredPerm: string,
): boolean {
  if (!interaction.guildId) {
    throw new Error("Guild only");
  }
  if (!interaction.member?.permissions?.has(requiredPerm)) {
    throw new Error(`Missing permission: ${requiredPerm}`);
  }
  return true;
}
