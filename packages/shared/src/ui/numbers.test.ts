import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatCompactNumber,
  formatCoins,
  formatXp,
  formatRep,
  parseNumber,
  formatDuration,
  formatDurationShort,
  formatDurationLong,
  formatCooldown,
  ordinal,
  formatPercentage,
  formatRatio,
  clamp,
  lerp,
  randomInt,
  randomFloat,
} from "./numbers.js";

describe("formatNumber", () => {
  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats positive integers with commas", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1000000)).toBe("1,000,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-1000)).toBe("-1,000");
    expect(formatNumber(-1234567)).toBe("-1,234,567");
  });

  it("formats decimals", () => {
    expect(formatNumber(1234.56, { maxDecimals: 2 })).toBe("1,234.56");
    expect(formatNumber(1234.5, { maxDecimals: 1 })).toBe("1,234.5");
  });

  it("respects maxDecimals", () => {
    expect(formatNumber(1234.567, { maxDecimals: 2 })).toBe("1,234.57");
    expect(formatNumber(1234.567, { maxDecimals: 0 })).toBe("1,235");
  });

  it("respects minDecimals", () => {
    expect(formatNumber(1000, { minDecimals: 2 })).toBe("1,000.00");
  });

  it("handles NaN and Infinity", () => {
    expect(formatNumber(NaN)).toBe("NaN");
    expect(formatNumber(Infinity)).toBe("NaN");
    expect(formatNumber(-Infinity)).toBe("NaN");
  });

  it("uses locale for formatting", () => {
    expect(formatNumber(1000, { locale: "de-DE" })).toBe("1.000");
    // fr-FR uses narrow no-break space (U+202F) for thousands separator
    expect(formatNumber(1000, { locale: "fr-FR" })).toMatch(/1[\s\u202F]000/);
  });
});

describe("formatCompactNumber", () => {
  it("formats thousands", () => {
    expect(formatCompactNumber(1500)).toBe("1.5K");
    expect(formatCompactNumber(9999)).toBe("10K");
  });

  it("formats millions", () => {
    expect(formatCompactNumber(1500000)).toBe("1.5M");
    expect(formatCompactNumber(9999999)).toBe("10M");
  });

  it("formats billions", () => {
    expect(formatCompactNumber(1500000000)).toBe("1.5B");
  });

  it("formats trillions", () => {
    expect(formatCompactNumber(1500000000000)).toBe("1.5T");
  });

  it("formats quadrillions", () => {
    expect(formatCompactNumber(1500000000000000)).toBe("1.5Qa");
  });

  it("formats numbers below 1000 without suffix", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(500)).toBe("500");
  });

  it("handles negative numbers", () => {
    expect(formatCompactNumber(-1500)).toBe("-1.5K");
  });

  it("uses locale", () => {
    expect(formatCompactNumber(1500, "de-DE")).toBe("1,5K");
  });
});

describe("formatCoins", () => {
  it("formats coin amounts compactly", () => {
    expect(formatCoins(100)).toBe("100");
    expect(formatCoins(1500)).toBe("1.5K");
    expect(formatCoins(1500000)).toBe("1.5M");
  });

  it("does not force decimal places", () => {
    expect(formatCoins(1000)).toBe("1K");
  });
});

describe("formatXp", () => {
  it("formats XP amounts compactly", () => {
    expect(formatXp(100)).toBe("100");
    expect(formatXp(1500)).toBe("1.5K");
    expect(formatXp(1500000)).toBe("1.5M");
  });
});

describe("formatRep", () => {
  it("formats reputation amounts compactly", () => {
    expect(formatRep(100)).toBe("100");
    expect(formatRep(1500)).toBe("1.5K");
  });
});

describe("parseNumber", () => {
  it("parses plain numbers", () => {
    expect(parseNumber("1000")).toBe(1000);
    expect(parseNumber("1,000")).toBe(1000);
    expect(parseNumber("-500")).toBe(-500);
  });

  it("parses compact notation with K", () => {
    expect(parseNumber("1.5K")).toBe(1500);
    expect(parseNumber("10K")).toBe(10000);
  });

  it("parses compact notation with M", () => {
    expect(parseNumber("2.5M")).toBe(2500000);
  });

  it("parses compact notation with B", () => {
    expect(parseNumber("1B")).toBe(1000000000);
  });

  it("parses compact notation with T", () => {
    expect(parseNumber("1T")).toBe(1000000000000);
  });

  it("returns null for invalid input", () => {
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1.5X")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats milliseconds to human readable", () => {
    expect(formatDuration(1000)).toBe("1 second");
    expect(formatDuration(60000)).toBe("1 minute");
    expect(formatDuration(3600000)).toBe("1 hour");
    expect(formatDuration(86400000)).toBe("1 day");
  });

  it("combines multiple units", () => {
    expect(formatDuration(3661000)).toBe("1 hour, 1 minute");
    expect(formatDuration(90061000)).toBe("1 day, 1 hour");
  });

  it("respects maxUnits", () => {
    expect(formatDuration(90061000, { maxUnits: 1 })).toBe("1 day");
    expect(formatDuration(90061000, { maxUnits: 3 })).toBe("1 day, 1 hour, 1 minute");
  });

  it("short format uses abbreviated units", () => {
    expect(formatDuration(3661000, { short: true })).toBe("1h 1m");
    expect(formatDuration(90061000, { short: true })).toBe("1d 1h");
  });

  it("returns empty string for zero or negative", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(-1000)).toBe("");
  });

  it("shows zero when showZero is true", () => {
    expect(formatDuration(0, { showZero: true })).toBe("0 seconds");
    expect(formatDuration(0, { short: true, showZero: true })).toBe("0s");
  });
});

describe("formatDurationShort", () => {
  it("formats in short format with max 2 units", () => {
    expect(formatDurationShort(3661000)).toBe("1h 1m");
    expect(formatDurationShort(90061000)).toBe("1d 1h");
  });
});

describe("formatDurationLong", () => {
  it("formats in long format with max 3 units", () => {
    expect(formatDurationLong(3661000)).toBe("1 hour, 1 minute, 1 second");
  });
});

describe("formatCooldown", () => {
  it("formats seconds as short duration", () => {
    expect(formatCooldown(61)).toBe("1m 1s");
    expect(formatCooldown(3661)).toBe("1h 1m");
  });
});

describe("ordinal", () => {
  it("adds correct suffix for 1st, 2nd, 3rd", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
  });

  it("adds th for 4-20", () => {
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(20)).toBe("20th");
  });

  it("handles teens correctly", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("handles higher numbers", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(100)).toBe("100th");
    expect(ordinal(101)).toBe("101st");
  });
});

describe("formatPercentage", () => {
  it("calculates percentage correctly", () => {
    expect(formatPercentage(50, 100)).toBe("50%");
    expect(formatPercentage(33, 100)).toBe("33%");
    expect(formatPercentage(1, 3)).toBe("33%");
  });

  it("supports decimals", () => {
    expect(formatPercentage(1, 3, 2)).toBe("33.33%");
    expect(formatPercentage(50, 100, 1)).toBe("50.0%");
  });

  it("handles zero max", () => {
    expect(formatPercentage(10, 0)).toBe("0%");
  });
});

describe("formatRatio", () => {
  it("formats ratio with compact numbers", () => {
    expect(formatRatio(50, 100)).toBe("50 / 100");
    expect(formatRatio(1500, 2000)).toBe("1.5K / 2K");
  });
});

describe("clamp", () => {
  it("returns value within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("interpolates correctly", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it("clamps t to 0-1", () => {
    expect(lerp(0, 10, -0.5)).toBe(0);
    expect(lerp(0, 10, 1.5)).toBe(10);
  });
});

describe("randomInt", () => {
  it("returns integer within range", () => {
    for (let i = 0; i < 100; i++) {
      const result = randomInt(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("handles min equals max", () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});

describe("randomFloat", () => {
  it("returns float within range", () => {
    for (let i = 0; i < 100; i++) {
      const result = randomFloat(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    }
  });
});