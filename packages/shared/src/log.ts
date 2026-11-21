import { pino } from "pino";

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

interface LogContext {
  service?: string;
  module?: string;
  guildId?: string;
  userId?: string;
  event?: string;
  durationMs?: number;
}

class Logger {
  private logger: pino.Logger;

  constructor(service: string, level?: LogLevel) {
    this.logger = pino({
      level,
      base: { service },
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  info(ctx: LogContext, message: string): void {
    this.logger.info(ctx, message);
  }

  warn(ctx: LogContext, message: string): void {
    this.logger.warn(ctx, message);
  }

  error(ctx: LogContext, message: string, err?: Error): void {
    this.logger.error({ err, ...ctx }, message);
  }

  debug(ctx: LogContext, message: string): void {
    this.logger.debug(ctx, message);
  }

  fatal(ctx: LogContext, message: string): void {
    this.logger.fatal(ctx, message);
  }

  child(ctx: LogContext): Logger {
    const bindings = this.logger.bindings();
    const svc = (bindings as { service?: string }).service;
    void this.logger.child(ctx);
    return new Logger(svc ?? "unknown", this.logger.level as LogLevel);
  }
}

export function createLogger(service: string, level?: LogLevel): Logger {
  return new Logger(service, level);
}

export { Logger };
