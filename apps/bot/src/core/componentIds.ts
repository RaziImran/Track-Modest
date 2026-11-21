export function encodeId(module: string, action: string, ...args: string[]): string {
  return [module, action, ...args].join(":");
}

export function decodeId(customId: string): { module: string; action: string; args: string[] } {
  const parts = customId.split(":");
  if (parts.length < 2) {
    throw new Error(`Invalid customId: ${customId}`);
  }
  const module = parts[0];
  const action = parts[1];
  if (!module || !action) {
    throw new Error(`Invalid customId: ${customId}`);
  }
  return { module, action, args: parts.slice(2) };
}

export function maxCustomIdLength(customId: string): number {
  return customId.length;
}
