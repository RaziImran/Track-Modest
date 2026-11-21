export async function cooldown(
  key: string,
  seconds: number,
  redis: { set: (k: string, v: string, opts: { NX: string; EX: number }) => Promise<string>; ttl: (k: string) => Promise<number> },
): Promise<void> {
  const setResult = await redis.set(key, "1", { NX: "NX", EX: seconds });
  if (setResult !== "OK") {
    const ttl = await redis.ttl(key);
    throw new Error(`Cooldown active. Try again in ${ttl}s.`);
  }
}
