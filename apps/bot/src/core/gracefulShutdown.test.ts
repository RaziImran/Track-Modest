import { describe, it, expect, vi } from "vitest";
import { runGracefulShutdown } from "./gracefulShutdown.js";

describe("gracefulShutdown", () => {
  it("runs steps", async () => {
    const stop = vi.fn();
    const finish = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    await runGracefulShutdown(
      { stopAcceptingInteractions: stop, finishInFlight: finish, closeConnections: close },
      10,
    );
    expect(stop).toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(10);
    expect(close).toHaveBeenCalled();
  });
});
