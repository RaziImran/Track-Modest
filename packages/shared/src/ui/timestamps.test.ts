import { describe, it, expect, vi } from "vitest";
import {
  timestamp,
  timestampRelative,
  timestampShortDateTime,
  timestampLongDateTime,
  timestampShortDate,
  timestampLongDate,
  timestampShortTime,
  timestampLongTime,
  now,
  fromDate,
  fromMs,
  toDate,
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  diffInSeconds,
  diffInMinutes,
  diffInHours,
  diffInDays,
  isPast,
  isFuture,
  isWithin,
  formatTimeUntil,
  formatTimeSince,
  dailyResetTimestamp,
  weeklyResetTimestamp,
  monthlyResetTimestamp,
  seasonalResetTimestamp,
} from "./timestamps.js";

describe("timestamp", () => {
  it("formats with default style 'f'", () => {
    const result = timestamp(1608768000);
    expect(result).toBe("<t:1608768000:f>");
  });

  it("formats with specified style", () => {
    expect(timestamp(1608768000, { style: "R" })).toBe("<t:1608768000:R>");
    expect(timestamp(1608768000, { style: "t" })).toBe("<t:1608768000:t>");
    expect(timestamp(1608768000, { style: "T" })).toBe("<t:1608768000:T>");
    expect(timestamp(1608768000, { style: "d" })).toBe("<t:1608768000:d>");
    expect(timestamp(1608768000, { style: "D" })).toBe("<t:1608768000:D>");
    expect(timestamp(1608768000, { style: "F" })).toBe("<t:1608768000:F>");
  });
});

describe("convenience timestamp functions", () => {
  const unix = 1608768000;

  it("timestampRelative uses style R", () => {
    expect(timestampRelative(unix)).toBe("<t:1608768000:R>");
  });

  it("timestampShortDateTime uses style f", () => {
    expect(timestampShortDateTime(unix)).toBe("<t:1608768000:f>");
  });

  it("timestampLongDateTime uses style F", () => {
    expect(timestampLongDateTime(unix)).toBe("<t:1608768000:F>");
  });

  it("timestampShortDate uses style d", () => {
    expect(timestampShortDate(unix)).toBe("<t:1608768000:d>");
  });

  it("timestampLongDate uses style D", () => {
    expect(timestampLongDate(unix)).toBe("<t:1608768000:D>");
  });

  it("timestampShortTime uses style t", () => {
    expect(timestampShortTime(unix)).toBe("<t:1608768000:t>");
  });

  it("timestampLongTime uses style T", () => {
    expect(timestampLongTime(unix)).toBe("<t:1608768000:T>");
  });
});

describe("now", () => {
  it("returns current unix timestamp in seconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = now();
    const after = Math.floor(Date.now() / 1000);
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe("fromDate", () => {
  it("converts Date to unix seconds", () => {
    const date = new Date("2021-01-01T00:00:00.000Z");
    expect(fromDate(date)).toBe(1609459200);
  });
});

describe("fromMs", () => {
  it("converts milliseconds to unix seconds", () => {
    expect(fromMs(1609459200000)).toBe(1609459200);
  });
});

describe("toDate", () => {
  it("converts unix seconds to Date", () => {
    const date = toDate(1609459200);
    expect(date.getTime()).toBe(1609459200000);
  });
});

describe("add functions", () => {
  const base = 1609459200; // 2021-01-01T00:00:00Z

  it("addSeconds adds correctly", () => {
    expect(addSeconds(base, 30)).toBe(base + 30);
  });

  it("addMinutes adds correctly", () => {
    expect(addMinutes(base, 5)).toBe(base + 300);
  });

  it("addHours adds correctly", () => {
    expect(addHours(base, 2)).toBe(base + 7200);
  });

  it("addDays adds correctly", () => {
    expect(addDays(base, 3)).toBe(base + 259200);
  });

  it("addWeeks adds correctly", () => {
    expect(addWeeks(base, 1)).toBe(base + 604800);
  });

  it("addMonths handles month boundaries", () => {
    const jan31 = new Date("2021-01-31T00:00:00.000Z");
    const result = addMonths(fromDate(jan31), 1);
    const resultDate = toDate(result);
    expect(resultDate.getUTCMonth()).toBe(1); // February
  });

  it("addYears handles year boundaries", () => {
    const result = addYears(base, 1);
    const resultDate = toDate(result);
    expect(resultDate.getUTCFullYear()).toBe(2022);
  });
});

describe("diff functions", () => {
  const base = 1609459200; // 2021-01-01T00:00:00Z
  const later = 1609545600; // 2021-01-02T00:00:00Z (1 day later)

  it("diffInSeconds returns difference", () => {
    expect(diffInSeconds(base, later)).toBe(86400);
  });

  it("diffInMinutes returns difference in minutes", () => {
    expect(diffInMinutes(base, later)).toBe(1440);
  });

  it("diffInHours returns difference in hours", () => {
    expect(diffInHours(base, later)).toBe(24);
  });

  it("diffInDays returns difference in days", () => {
    expect(diffInDays(base, later)).toBe(1);
  });

  it("uses now() as default reference", () => {
    const result = diffInSeconds(1609459200);
    expect(result).toBeGreaterThan(0);
  });
});

describe("isPast", () => {
  it("returns true for past timestamp", () => {
    expect(isPast(1000, 2000)).toBe(true);
  });

  it("returns false for future timestamp", () => {
    expect(isPast(3000, 2000)).toBe(false);
  });

  it("returns false for equal timestamp", () => {
    expect(isPast(2000, 2000)).toBe(false);
  });
});

describe("isFuture", () => {
  it("returns true for future timestamp", () => {
    expect(isFuture(3000, 2000)).toBe(true);
  });

  it("returns false for past timestamp", () => {
    expect(isFuture(1000, 2000)).toBe(false);
  });

  it("returns false for equal timestamp", () => {
    expect(isFuture(2000, 2000)).toBe(false);
  });
});

describe("isWithin", () => {
  it("returns true when within window", () => {
    expect(isWithin(2000, 1000, 1500)).toBe(true);
    expect(isWithin(1000, 1000, 1500)).toBe(true);
    expect(isWithin(1500, 1000, 1500)).toBe(true);
  });

  it("returns false when outside window", () => {
    expect(isWithin(3000, 1000, 1500)).toBe(false);
    expect(isWithin(0, 1000, 1500)).toBe(false);
  });
});

describe("formatTimeUntil", () => {
  it("returns 'now' for past or present target", () => {
    expect(formatTimeUntil(1000, 2000)).toBe("now");
    expect(formatTimeUntil(2000, 2000)).toBe("now");
  });

  it("formats days, hours, minutes", () => {
    expect(formatTimeUntil(1000 + 86400, 1000)).toBe("1d");
    expect(formatTimeUntil(1000 + 3600, 1000)).toBe("1h");
    expect(formatTimeUntil(1000 + 60, 1000)).toBe("1m");
    expect(formatTimeUntil(1000 + 30, 1000)).toBe("30s");
  });

  it("combines units", () => {
    expect(formatTimeUntil(1000 + 90061, 1000)).toBe("1d 1h");
  });

  it("limits to 2 units", () => {
    expect(formatTimeUntil(1000 + 90061 + 60, 1000)).toBe("1d 1h");
  });
});

describe("formatTimeSince", () => {
  it("returns 'just now' for future or present from", () => {
    expect(formatTimeSince(2000, 1000)).toBe("just now");
    expect(formatTimeSince(1000, 1000)).toBe("just now");
  });

  it("formats days, hours, minutes, seconds ago", () => {
    expect(formatTimeSince(1000, 1000 + 86400)).toBe("1d ago");
    expect(formatTimeSince(1000, 1000 + 3600)).toBe("1h ago");
    expect(formatTimeSince(1000, 1000 + 60)).toBe("1m ago");
    expect(formatTimeSince(1000, 1000 + 30)).toBe("30s ago");
  });
});

describe("dailyResetTimestamp", () => {
  it("returns next midnight UTC by default", () => {
    const fixedNow = new Date("2021-01-01T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = dailyResetTimestamp();
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCHours()).toBe(0);
    expect(resultDate.getUTCMinutes()).toBe(0);
    expect(resultDate.getUTCSeconds()).toBe(0);
    expect(resultDate.getUTCDate()).toBe(2); // Next day

    vi.useRealTimers();
  });

  it("respects custom hour/minute/second", () => {
    const fixedNow = new Date("2021-01-01T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = dailyResetTimestamp(6, 30, 0);
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCHours()).toBe(6);
    expect(resultDate.getUTCMinutes()).toBe(30);

    vi.useRealTimers();
  });

  it("respects timezone offset", () => {
    const fixedNow = new Date("2021-01-01T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = dailyResetTimestamp(0, 0, 0, 60); // UTC+1
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCHours()).toBe(23); // 00:00 UTC+1 = 23:00 UTC

    vi.useRealTimers();
  });
});

describe("weeklyResetTimestamp", () => {
  it("returns next specified day of week", () => {
    const fixedNow = new Date("2021-01-01T12:00:00.000Z").getTime(); // Friday
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = weeklyResetTimestamp(1); // Monday
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCDay()).toBe(1);
    expect(resultDate.getUTCDate()).toBe(4); // 2021-01-04

    vi.useRealTimers();
  });

  it("returns next week if today is target day but time passed", () => {
    const fixedNow = new Date("2021-01-04T12:00:00.000Z").getTime(); // Monday noon
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = weeklyResetTimestamp(1, 6, 0, 0); // Monday 6am
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCDate()).toBe(11); // Next Monday

    vi.useRealTimers();
  });
});

describe("monthlyResetTimestamp", () => {
  it("returns next specified day of month", () => {
    const fixedNow = new Date("2021-01-15T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = monthlyResetTimestamp(1); // 1st of month
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCDate()).toBe(1);
    expect(resultDate.getUTCMonth()).toBe(1); // February

    vi.useRealTimers();
  });

  it("returns this month if day not yet passed", () => {
    const fixedNow = new Date("2021-01-15T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = monthlyResetTimestamp(20); // 20th of month
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCDate()).toBe(20);
    expect(resultDate.getUTCMonth()).toBe(0); // January

    vi.useRealTimers();
  });
});

describe("seasonalResetTimestamp", () => {
  it("returns next season start", () => {
    const fixedNow = new Date("2021-06-15T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = seasonalResetTimestamp(1, 1); // January 1st
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCMonth()).toBe(0);
    expect(resultDate.getUTCDate()).toBe(1);
    expect(resultDate.getUTCFullYear()).toBe(2022);

    vi.useRealTimers();
  });

  it("returns this year if season not yet started", () => {
    const fixedNow = new Date("2021-06-15T12:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const result = seasonalResetTimestamp(7, 1); // July 1st
    const resultDate = new Date(result * 1000);
    expect(resultDate.getUTCMonth()).toBe(6);
    expect(resultDate.getUTCDate()).toBe(1);
    expect(resultDate.getUTCFullYear()).toBe(2021);

    vi.useRealTimers();
  });
});