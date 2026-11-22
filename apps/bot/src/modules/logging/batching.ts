export const MAX_BATCH_SIZE = 10;
export const FLUSH_INTERVAL_MS = 2000;

export interface BatchedEmbed {
  category: string;
  payload: unknown;
}

export class LogBatcher {
  private queue: BatchedEmbed[] = [];
  private timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  constructor(private readonly flush: (items: BatchedEmbed[]) => void) {}

  enqueue(item: BatchedEmbed): void {
    this.queue.push(item);
    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flushNow();
    } else if (!this.timer) {
      this.timer = globalThis.setTimeout(() => this.flushNow(), FLUSH_INTERVAL_MS);
    }
  }

  flushNow(): void {
    if (this.timer) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    const items = this.queue.splice(0, MAX_BATCH_SIZE);
    this.flush(items);
  }

  size(): number {
    return this.queue.length;
  }
}
