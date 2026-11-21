// §6.9 Module enable/disable.
// Pure helpers: NO discord.js imports. Unit-testable without a real database.

/** Check whether a module is enabled for a guild.
 * Modules default to enabled; only an explicit `false` disables them.
 */
export function isModuleEnabled(
  modules: Record<string, boolean>,
  moduleName: string,
): boolean {
  return modules[moduleName] !== false;
}

/** Reply text sent when a command's module is disabled on this guild. */
export function moduleDisabledMessage(): string {
  return `This feature is turned off on this server. An admin can enable it with /settings.`;
}
