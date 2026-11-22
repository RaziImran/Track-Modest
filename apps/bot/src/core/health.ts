export type HealthStatus = "ok" | "degraded";

export interface HealthReport {
  status: HealthStatus;
  gateway: boolean;
  db: boolean;
  redis: boolean;
  timestamp: string;
}

export function buildHealthReport(
  gateway: boolean,
  db: boolean,
  redis: boolean,
  now: Date = new Date(),
): HealthReport {
  const ok = gateway && db && redis;
  return {
    status: ok ? "ok" : "degraded",
    gateway,
    db,
    redis,
    timestamp: now.toISOString(),
  };
}
