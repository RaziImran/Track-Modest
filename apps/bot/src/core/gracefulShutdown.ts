export interface ShutdownDeps {
  stopAcceptingInteractions: () => void | Promise<void>;
  finishInFlight: (timeoutMs: number) => Promise<void>;
  closeConnections: () => void | Promise<void>;
}

export async function runGracefulShutdown(
  deps: ShutdownDeps,
  timeoutMs: number = 10000,
): Promise<void> {
  await deps.stopAcceptingInteractions();
  await Promise.race([
    deps.finishInFlight(timeoutMs),
    new Promise<void>((resolve) => globalThis.setTimeout(resolve, timeoutMs)),
  ]);
  await deps.closeConnections();
}
