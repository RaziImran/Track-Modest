import { describe, expect, it, vi } from "vitest";
import { checkCooldown } from "./cooldown.js";

function createMockRedis(setResult: string | null, ttlResult: number) {
  const set = vi.fn(async () => setResult);
  const ttl = vi.fn(async () => ttlResult);
  return { set, ttl };
}

describe("checkCooldown", () => {
  it("allows when NX returns OK", async () => {
    const redis = createMockRedis("OK", 0);

    await expect(
      checkCooldown(redis, "ban", "guild1", "user1", 60, "none"),
    ).resolves.toBeUndefined();

    expect(redis.set).toHaveBeenCalledWith("cd:ban:guild1:user1", "1", { NX: "NX", EX: 60 });
    expect(redis.ttl).not.toHaveBeenCalled();
  });

  it("throws with TTL when key already exists", async () => {
    const redis = createMockRedis(null, 30);

    await expect(
      checkCooldown(redis, "ban", "guild1", "user1", 60, "none"),
    ).rejects.toThrow("Try again in 30s");

    expect(redis.set).toHaveBeenCalledWith("cd:ban:guild1:user1", "1", { NX: "NX", EX: 60 });
    expect(redis.ttl).toHaveBeenCalledWith("cd:ban:guild1:user1");
  });

  it("bypasses cooldown for moderator", async () => {
    const redis = createMockRedis(null, 30);

    await expect(
      checkCooldown(redis, "ban", "guild1", "user1", 60, "moderator"),
    ).resolves.toBeUndefined();

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.ttl).not.toHaveBeenCalled();
  });

  it("bypasses cooldown for admin", async () => {
    const redis = createMockRedis(null, 30);

    await expect(
      checkCooldown(redis, "ban", "guild1", "user1", 60, "admin"),
    ).resolves.toBeUndefined();

    expect(redis.set).not.toHaveBeenCalled();
  });

  it("bypasses cooldown for owner", async () => {
    const redis = createMockRedis(null, 30);

    await expect(
      checkCooldown(redis, "ban", "guild1", "user1", 60, "owner"),
    ).resolves.toBeUndefined();

    expect(redis.set).not.toHaveBeenCalled();
  });

  it("does not bypass for helper", async () => {
    const redis = createMockRedis(null, 45);

    await expect(
      checkCooldown(redis, "ban", "guild1", "user1", 60, "helper"),
    ).rejects.toThrow("Try again in 45s");
  });
});
