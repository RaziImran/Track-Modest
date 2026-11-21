import { describe, expect, it, vi } from "vitest";
import type { ConfirmInteraction } from "./confirm.js";
import { createConfirm } from "./confirm.js";

interface MockCollector {
  on: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockSent {
  createMessageComponentCollector: ReturnType<typeof vi.fn>;
}

interface MockInteraction {
  reply: ReturnType<typeof vi.fn>;
}

function createMockInteraction() {
  const collector = {
    on: vi.fn(),
    stop: vi.fn(),
  } as unknown as MockCollector;

  const sent = {
    createMessageComponentCollector: vi.fn(() => collector),
  } as unknown as MockSent;

  const interaction = {
    reply: vi.fn(async () => sent),
  } as unknown as MockInteraction;

  return { interaction, collector, sent };
}

function simulateCollect(collector: MockCollector, customId: string): void {
  const onCollect = collector.on.mock.calls.find(([event]) => event === "collect")?.[1];
  if (onCollect) {
    onCollect({ customId });
  }
}

function simulateEnd(collector: MockCollector): void {
  const onEnd = collector.on.mock.calls.find(([event]) => event === "end")?.[1];
  if (onEnd) {
    onEnd();
  }
}

describe("createConfirm", () => {
  it("returns true when Confirm is clicked", async () => {
    const { interaction, collector } = createMockInteraction();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const promise = createConfirm(
      interaction as unknown as ConfirmInteraction,
      "Are you sure?",
      { onConfirm, onCancel },
      60,
    );

    await Promise.resolve();

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Are you sure?",
      components: expect.any(Array),
      ephemeral: true,
      fetchReply: true,
    });

    simulateCollect(collector, "confirm");

    await expect(promise).resolves.toBe(true);
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("returns false when Cancel is clicked", async () => {
    const { interaction, collector } = createMockInteraction();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const promise = createConfirm(
      interaction as unknown as ConfirmInteraction,
      "Are you sure?",
      { onConfirm, onCancel },
      60,
    );

    await Promise.resolve();

    simulateCollect(collector, "cancel");

    await expect(promise).resolves.toBe(false);
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("returns false on timeout", async () => {
    const { interaction, collector } = createMockInteraction();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const promise = createConfirm(
      interaction as unknown as ConfirmInteraction,
      "Are you sure?",
      { onConfirm, onCancel },
      60,
    );

    await Promise.resolve();

    simulateEnd(collector);

    await expect(promise).resolves.toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("stops the collector after a choice is made", async () => {
    const { interaction, collector } = createMockInteraction();

    const promise = createConfirm(
      interaction as unknown as ConfirmInteraction,
      "Are you sure?",
      { onConfirm: () => {}, onCancel: () => {} },
      60,
    );

    await Promise.resolve();

    simulateCollect(collector, "confirm");

    await promise;
    expect(collector.stop).toHaveBeenCalled();
  });
});
