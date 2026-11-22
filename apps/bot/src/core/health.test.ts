import { describe, it, expect } from "vitest";
import { buildHealthReport } from "./health.js";

describe("health", () => {
  it("ok when all true", () => {
    const r = buildHealthReport(true, true, true, new Date("2026-01-01T00:00:00Z"));
    expect(r.status).toBe("ok");
    expect(r.timestamp).toBe("2026-01-01T00:00:00.000Z");
  });
  it("degraded when any false", () => {
    expect(buildHealthReport(false, true, true).status).toBe("degraded");
    expect(buildHealthReport(true, false, true).db).toBe(false);
  });
});
