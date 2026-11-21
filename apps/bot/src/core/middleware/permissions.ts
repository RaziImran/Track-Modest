export async function permissions(
  interaction: { member?: { permissions?: { has: (perm: string) => boolean } } },
  required: string[],
): Promise<void> {
  if (!interaction.member?.permissions) {
    throw new Error("Unable to verify permissions.");
  }
  for (const perm of required) {
    if (!interaction.member.permissions.has(perm)) {
      throw new Error(`Missing permission: ${perm}`);
    }
  }
}
