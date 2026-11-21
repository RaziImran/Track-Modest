import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env["NODE_ENV"];
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function setEnv(vars: Record<string, string>) {
    for (const [k, v] of Object.entries(vars)) {
      process.env[k] = v;
    }
  }

  it("loads valid env for bot app", async () => {
    setEnv({
      DISCORD_TOKEN: "1234567890",
      DISCORD_CLIENT_ID: "client123",
      DISCORD_CLIENT_SECRET: "secret123",
      DEV_GUILD_ID: "guild123",
      DATABASE_URL: "postgresql://localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      GEMINI_API_KEY: "gemini123",
      AI_MODEL_CHAT: "gemini-1.5-flash",
      AI_MODEL_FAST: "gemini-1.5-flash",
      AI_MODEL_VISION: "gemini-1.5-flash",
      AI_MODEL_LIVE: "gemini-live",
      AI_GLOBAL_DAILY_REQUEST_LIMIT: "1000",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "sessionsecret",
      LOG_LEVEL: "info",
      NODE_ENV: "development",
    });

    const { loadEnv } = await import("./env.js");
    const env = loadEnv("bot");
    expect(env.DISCORD_TOKEN).toBe("1234567890");
    expect(env.AI_GLOBAL_DAILY_REQUEST_LIMIT).toBe(1000);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("throws when required env is missing for bot app", async () => {
    setEnv({
      DATABASE_URL: "postgresql://localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      LOG_LEVEL: "info",
      NODE_ENV: "development",
    });

    const { loadEnv } = await import("./env.js");
    expect(() => loadEnv("bot")).toThrow(/Missing or invalid env/);
  });

  it("throws when DATABASE_URL missing for worker app", async () => {
    setEnv({
      REDIS_URL: "redis://localhost:6379",
      LOG_LEVEL: "info",
      NODE_ENV: "development",
    });

    const { loadEnv } = await import("./env.js");
    expect(() => loadEnv("worker")).toThrow(/DATABASE_URL/);
  });

  it("getEnv throws before loadEnv", async () => {
    const { getEnv } = await import("./env.js");
    expect(() => getEnv()).toThrow(/Env not loaded/);
  });

  it("validates LOG_LEVEL enum", async () => {
    setEnv({
      DISCORD_TOKEN: "123",
      DISCORD_CLIENT_ID: "client123",
      DISCORD_CLIENT_SECRET: "secret123",
      DEV_GUILD_ID: "guild123",
      DATABASE_URL: "postgresql://localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      GEMINI_API_KEY: "gemini123",
      AI_MODEL_CHAT: "gemini-1.5-flash",
      AI_MODEL_FAST: "gemini-1.5-flash",
      AI_MODEL_VISION: "gemini-1.5-flash",
      AI_MODEL_LIVE: "gemini-live",
      AI_GLOBAL_DAILY_REQUEST_LIMIT: "1000",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "sessionsecret",
      LOG_LEVEL: "invalid",
      NODE_ENV: "development",
    });

    const { loadEnv } = await import("./env.js");
    expect(() => loadEnv("bot")).toThrow();
  });

  it("validates NEXTAUTH_URL is a valid URL", async () => {
    setEnv({
      DISCORD_TOKEN: "123",
      DISCORD_CLIENT_ID: "client123",
      DISCORD_CLIENT_SECRET: "secret123",
      DEV_GUILD_ID: "guild123",
      DATABASE_URL: "postgresql://localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      GEMINI_API_KEY: "gemini123",
      AI_MODEL_CHAT: "gemini-1.5-flash",
      AI_MODEL_FAST: "gemini-1.5-flash",
      AI_MODEL_VISION: "gemini-1.5-flash",
      AI_MODEL_LIVE: "gemini-live",
      AI_GLOBAL_DAILY_REQUEST_LIMIT: "1000",
      NEXTAUTH_URL: "not-a-url",
      NEXTAUTH_SECRET: "sessionsecret",
      LOG_LEVEL: "info",
      NODE_ENV: "development",
    });

    const { loadEnv } = await import("./env.js");
    expect(() => loadEnv("dashboard")).toThrow();
  });
});
