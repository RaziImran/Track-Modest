import * as Sentry from "@sentry/node";

export function initSentry(dsn?: string, options?: {
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: options?.environment,
    release: options?.release,
    tracesSampleRate: options?.tracesSampleRate ?? 0,
    beforeSend(event, hint) {
      if (hint?.originalException) {
        const err = hint.originalException as Error;
        if (err.message?.includes("token") || err.message?.includes("secret") || err.message?.includes("key")) {
          return null;
        }
      }
      return event;
    },
  });
}

export { Sentry };
