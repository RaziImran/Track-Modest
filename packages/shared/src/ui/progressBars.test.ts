import { describe, it, expect } from "vitest";
import {
  progressBar,
  progressBarEmoji,
  progressBarWithFallback,
  xpProgressBar,
  streakProgressBar,
  circularProgressBar,
  multiSegmentBar,
} from "./progressBars.js";

describe("progressBar", () => {
  it("returns empty bar for zero max", () => {
    const result = progressBar(10, 0);
    expect(result).toContain("▱");
    expect(result).toContain("0%");
  });

  it("returns full bar for value >= max", () => {
    const result = progressBar(100, 50);
    expect(result).toContain("▰".repeat(10));
    expect(result).toContain("100%");
  });

  it("returns empty bar for zero value", () => {
    const result = progressBar(0, 100);
    expect(result).toContain("▱".repeat(10));
    expect(result).toContain("0%");
  });

  it("calculates percentage correctly", () => {
    const result = progressBar(50, 100);
    expect(result).toContain("50%");
  });

  it("rounds percentage correctly", () => {
    const result = progressBar(33, 100);
    expect(result).toContain("33%");
  });

  it("uses custom width", () => {
    const result = progressBar(50, 100, { width: 20 });
    const filledCount = (result.match(/▰/g) || []).length;
    const emptyCount = (result.match(/▱/g) || []).length;
    expect(filledCount + emptyCount).toBe(20);
  });

  it("uses custom filled/empty characters", () => {
    const result = progressBar(50, 100, { filled: "#", empty: "-" });
    expect(result).toContain("#");
    expect(result).toContain("-");
  });

  it("uses custom caps", () => {
    const result = progressBar(50, 100, { leftCap: "[", rightCap: "]" });
    expect(result.startsWith("[")).toBe(true);
    expect(result.includes("]")).toBe(true);
  });

  it("hides percentage when showPercentage is false", () => {
    const result = progressBar(50, 100, { showPercentage: false });
    expect(result).not.toContain("%");
  });

  it("clamps negative values to 0", () => {
    const result = progressBar(-10, 100);
    expect(result).toContain("0%");
  });

  it("clamps values above max to max", () => {
    const result = progressBar(150, 100);
    expect(result).toContain("100%");
  });
});

describe("progressBarEmoji", () => {
  it("uses emoji characters by default", () => {
    const result = progressBarEmoji(50, 100);
    expect(result).toContain("<:progress_filled:");
    expect(result).toContain("<:progress_empty:");
  });

  it("allows overriding emoji options", () => {
    const result = progressBarEmoji(50, 100, { filled: "<:custom_filled:123>" });
    expect(result).toContain("<:custom_filled:123>");
  });
});

describe("progressBarWithFallback", () => {
  it("uses custom emoji when provided", () => {
    const result = progressBarWithFallback(50, 100, {
      filled: "<:custom_filled:123>",
      empty: "<:custom_empty:123>",
    });
    expect(result).toContain("<:custom_filled:123>");
    expect(result).toContain("<:custom_empty:123>");
  });

  it("falls back to default when custom emoji is null", () => {
    const result = progressBarWithFallback(50, 100, null);
    expect(result).toContain("▰");
    expect(result).toContain("▱");
  });
});

describe("xpProgressBar", () => {
  it("uses width 12 by default", () => {
    const result = xpProgressBar(50, 100);
    const filledCount = (result.match(/▰/g) || []).length;
    const emptyCount = (result.match(/▱/g) || []).length;
    expect(filledCount + emptyCount).toBe(12);
  });

  it("shows percentage", () => {
    const result = xpProgressBar(50, 100);
    expect(result).toContain("50%");
  });

  it("allows custom options", () => {
    const result = xpProgressBar(50, 100, { filled: "#", empty: "-" });
    expect(result).toContain("#");
  });
});

describe("streakProgressBar", () => {
  it("uses fire emoji for filled", () => {
    const result = streakProgressBar(5, 10);
    expect(result).toContain("🔥");
  });

  it("uses white square for empty", () => {
    const result = streakProgressBar(5, 10);
    expect(result).toContain("⬜");
  });

  it("does not show percentage by default", () => {
    const result = streakProgressBar(5, 10);
    expect(result).not.toContain("%");
  });

  it("uses width 10 by default", () => {
    const result = streakProgressBar(5, 10);
    const fireCount = (result.match(/🔥/g) || []).length;
    const emptyCount = (result.match(/⬜/g) || []).length;
    expect(fireCount + emptyCount).toBe(10);
  });
});

describe("circularProgressBar", () => {
  it("returns correct segments for small size", () => {
    const result = circularProgressBar(50, "small");
    expect(result.length).toBe(8);
  });

  it("returns correct segments for medium size", () => {
    const result = circularProgressBar(50, "medium");
    expect(result.length).toBe(12);
  });

  it("returns correct segments for large size", () => {
    const result = circularProgressBar(50, "large");
    expect(result.length).toBe(16);
  });

  it("shows filled for 100%", () => {
    const result = circularProgressBar(100, "medium");
    expect(result).toBe("●".repeat(12));
  });

  it("shows empty for 0%", () => {
    const result = circularProgressBar(0, "medium");
    expect(result).toBe("○".repeat(12));
  });

  it("rounds correctly", () => {
    const result = circularProgressBar(25, "medium");
    expect(result).toBe("●".repeat(3) + "○".repeat(9));
  });
});

describe("multiSegmentBar", () => {
  it("returns empty string for empty segments", () => {
    const result = multiSegmentBar([]);
    expect(result).toBe("");
  });

  it("distributes width proportionally", () => {
    const result = multiSegmentBar([
      { value: 50, max: 100, label: "A" },
      { value: 50, max: 100, label: "B" },
    ], 20);
    expect(result.length).toBe(20);
  });

  it("handles segments with different max values", () => {
    const result = multiSegmentBar([
      { value: 100, max: 200, label: "A" },
      { value: 50, max: 100, label: "B" },
    ], 20);
    expect(result.length).toBe(20);
  });

  it("handles zero max values", () => {
    const result = multiSegmentBar([
      { value: 0, max: 0, label: "A" },
    ], 10);
    expect(result).toBe("▱".repeat(10));
  });
});