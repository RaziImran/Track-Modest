import client from "prom-client";

export const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

export const commandsTotal = new client.Counter({
  name: "commands_total",
  help: "Total number of commands executed",
  registers: [registry],
});

export const eventsTotal = new client.Counter({
  name: "events_total",
  help: "Total number of events processed",
  registers: [registry],
});

export const automodChecksTotal = new client.Counter({
  name: "automod_checks_total",
  help: "Total number of automod checks",
  registers: [registry],
});

export const aiRequestsTotal = new client.Counter({
  name: "ai_requests_total",
  help: "Total number of AI requests",
  registers: [registry],
});

export const aiErrorsTotal = new client.Counter({
  name: "ai_errors_total",
  help: "Total number of AI errors",
  registers: [registry],
});

export const commandLatencySeconds = new client.Histogram({
  name: "command_latency_seconds",
  help: "Command latency in seconds",
  registers: [registry],
});

export const automodCheckSeconds = new client.Histogram({
  name: "automod_check_seconds",
  help: "Automod check time in seconds",
  registers: [registry],
});

export const activeVoiceSessions = new client.Gauge({
  name: "active_voice_sessions",
  help: "Number of active voice sessions",
  registers: [registry],
});

export const gameRooms = new client.Gauge({
  name: "game_rooms",
  help: "Number of game rooms",
  registers: [registry],
});

export const queueLength = new client.Gauge({
  name: "queue_length",
  help: "Queue length",
  registers: [registry],
});

export const dbPoolUsage = new client.Gauge({
  name: "db_pool_usage",
  help: "DB pool usage",
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}
