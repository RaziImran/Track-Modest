import type { StaffLevel } from "../../../../../packages/shared/src/staff.js";
import { levelSatisfies } from "../../../../../packages/shared/src/staff.js";

export async function checkCooldown(
  redis: {
    set: (k: string, v: string, opts: { NX: string; EX: number }) => Promise<string | null>;
    ttl: (k: string) => Promise<number>;
  },
  command: string,
  guildId: string,
  userId: string,
  seconds: number,
  staffLevel: StaffLevel,
): Promise<void> {
  if (levelSatisfies("moderator", staffLevel)) {
    return;
  }

  const key = `cd:${command}:${guildId}:${userId}`;
  const setResult = await redis.set(key, "1", { NX: "NX", EX: seconds });
  if (setResult === "OK") {
    return;
  }

  const ttl = await redis.ttl(key);
  throw new Error(`Try again in ${ttl}s`);
}
