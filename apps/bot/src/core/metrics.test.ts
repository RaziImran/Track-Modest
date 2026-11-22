import { describe, it, expect } from "vitest";
import { metricsText, commandsTotal } from "./metrics.js";

describe("metrics", () => {
  it("exposes prometheus text", async () => {
    commandsTotal.inc();
    const text = await metricsText();
    expect(text).toContain("commands_total");
  });
});
