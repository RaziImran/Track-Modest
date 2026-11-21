import { z } from "zod";

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DEV_GUILD_ID: z.string().min(1),

  // Database / cache
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // AI
  GEMINI_API_KEY: z.string().min(1),
  AI_MODEL_CHAT: z.string().min(1),
  AI_MODEL_FAST: z.string().min(1),
  AI_MODEL_VISION: z.string().min(1),
  AI_MODEL_LIVE: z.string().min(1),
  AI_GLOBAL_DAILY_REQUEST_LIMIT: z.string().min(1).transform((val) => {
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) throw new Error("Invalid limit");
    return num;
  }),

  // Dashboard
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),

  // Activity / game
  ACTIVITY_PUBLIC_URL: z.string().url().optional(),
  GAME_SERVER_URL: z.string().url().optional(),

  // Ops
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

type Env = z.infer<typeof envSchema>;

type AppName = "bot" | "worker" | "voice" | "game-server" | "activity" | "dashboard";

const requiredByApp: Record<AppName, (keyof Env)[]> = {
  bot: ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DEV_GUILD_ID", "DATABASE_URL", "REDIS_URL", "GEMINI_API_KEY", "AI_MODEL_CHAT", "AI_MODEL_FAST", "AI_MODEL_VISION", "AI_MODEL_LIVE", "AI_GLOBAL_DAILY_REQUEST_LIMIT", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "LOG_LEVEL", "NODE_ENV"],
  worker: ["DATABASE_URL", "REDIS_URL", "LOG_LEVEL", "NODE_ENV"],
  voice: ["DATABASE_URL", "REDIS_URL", "GEMINI_API_KEY", "AI_MODEL_LIVE", "LOG_LEVEL", "NODE_ENV"],
  "game-server": ["DATABASE_URL", "REDIS_URL", "LOG_LEVEL", "NODE_ENV"],
  activity: ["ACTIVITY_PUBLIC_URL", "GAME_SERVER_URL", "LOG_LEVEL", "NODE_ENV"],
  dashboard: ["DATABASE_URL", "REDIS_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "LOG_LEVEL", "NODE_ENV"],
};

let cachedEnv: Env | null = null;

export function loadEnv(app: AppName): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(`Missing or invalid env variables: ${missing.join(", ")}`);
  }

  const env = parsed.data;
  const required = requiredByApp[app];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`App "${app}" requires missing env variables: ${missing.join(", ")}`);
  }

  cachedEnv = env;
  return env;
}

export function getEnv(): Env {
  if (!cachedEnv) throw new Error("Env not loaded. Call loadEnv() first.");
  return cachedEnv;
}

export { envSchema };
