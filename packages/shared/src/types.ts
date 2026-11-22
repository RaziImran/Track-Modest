export type ModuleName =
  | "setup"
  | "config"
  | "moderation"
  | "automod"
  | "antiraid"
  | "logging"
  | "reputation"
  | "xp"
  | "companion"
  | "economy"
  | "games"
  | "tickets"
  | "core";

export interface CommandContext {
  interaction: unknown;
  config: unknown;
  staffLevel: "none" | "helper" | "moderator" | "admin" | "owner";
  t: (key: string, params?: Record<string, unknown>) => string;
  success: (message: string, ctx?: unknown) => Promise<void>;
  error: (message: string, ctx?: unknown) => Promise<void>;
  confirm: (message: string, ctx?: unknown) => Promise<boolean>;
}

export interface BotCommand {
  data: { name: string; toJSON: () => unknown };
  module: ModuleName;
  defaultMemberPermissions?: unknown;
  botPermissions?: unknown[];
  staffLevel?: "none" | "helper" | "moderator" | "admin" | "owner";
  cooldownSeconds?: number;
  defer?: "ephemeral" | "public" | false;
  execute(ctx: CommandContext): Promise<void>;
  autocomplete?(ctx: unknown): Promise<void>;
}
