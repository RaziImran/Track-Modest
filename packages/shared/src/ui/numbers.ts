const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export interface FormatNumberOptions {
  locale?: string;
  compact?: boolean;
  maxDecimals?: number;
  minDecimals?: number;
  forceSuffix?: string;
}

export function formatNumber(
  num: number,
  options: FormatNumberOptions = {},
): string {
  const {
    locale = "en-US",
    compact = false,
    maxDecimals = 1,
    minDecimals = 0,
    forceSuffix,
  } = options;

  if (!Number.isFinite(num)) {
    return "NaN";
  }

  if (num === 0) {
    return "0";
  }

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (compact || forceSuffix) {
    let suffixIndex = 0;
    let displayNum = absNum;

    if (forceSuffix) {
      suffixIndex = SUFFIXES.indexOf(forceSuffix.toUpperCase());
      if (suffixIndex === -1) {
        suffixIndex = 0;
      }
      displayNum = absNum / Math.pow(1000, suffixIndex);
    } else {
      while (displayNum >= 1000 && suffixIndex < SUFFIXES.length - 1) {
        displayNum /= 1000;
        suffixIndex++;
      }
    }

    const suffix = SUFFIXES[suffixIndex];
    const effectiveMaxDecimals = Math.max(maxDecimals, minDecimals);
    const formatted = displayNum.toLocaleString(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: effectiveMaxDecimals,
    });

    return `${sign}${formatted}${suffix}`;
  }

  const effectiveMaxDecimals = Math.max(maxDecimals, minDecimals);
  return sign + absNum.toLocaleString(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: effectiveMaxDecimals,
  });
}

export function formatCompactNumber(num: number, locale = "en-US"): string {
  return formatNumber(num, { locale, compact: true, maxDecimals: 1 });
}

export function formatCoins(amount: number, locale = "en-US"): string {
  return formatNumber(amount, { locale, compact: true, maxDecimals: 1, minDecimals: 0 });
}

export function formatXp(amount: number, locale = "en-US"): string {
  return formatNumber(amount, { locale, compact: true, maxDecimals: 1 });
}

export function formatRep(amount: number, locale = "en-US"): string {
  return formatNumber(amount, { locale, compact: true, maxDecimals: 1 });
}

export function parseNumber(str: string): number | null {
  const cleaned = str.replace(/,/g, "").trim().toUpperCase();
  const match = cleaned.match(/^(-?)(\d+(?:\.\d+)?)([KMGTQSPONDCB]?)$/);
  if (!match) return null;

  const [, sign, numStr, suffix] = match;
  const numStrVal = numStr ?? "";
  const num = Number.parseFloat(numStrVal);
  if (Number.isNaN(num)) return null;

  const suffixStr = suffix ?? "";
  const suffixIndex = SUFFIXES.indexOf(suffixStr);
  if (suffixIndex === -1) return sign === "-" ? -num : num;

  const multiplier = Math.pow(1000, suffixIndex);
  return sign === "-" ? -num * multiplier : num * multiplier;
}

export interface DurationFormatOptions {
  locale?: string;
  short?: boolean;
  maxUnits?: number;
  showZero?: boolean;
}

const TIME_UNITS = [
  { unit: "year", ms: 365.25 * 24 * 60 * 60 * 1000, short: "y", long: "year" },
  { unit: "month", ms: 30.44 * 24 * 60 * 60 * 1000, short: "mo", long: "month" },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000, short: "w", long: "week" },
  { unit: "day", ms: 24 * 60 * 60 * 1000, short: "d", long: "day" },
  { unit: "hour", ms: 60 * 60 * 1000, short: "h", long: "hour" },
  { unit: "minute", ms: 60 * 1000, short: "m", long: "minute" },
  { unit: "second", ms: 1000, short: "s", long: "second" },
];

export function formatDuration(
  ms: number,
  options: DurationFormatOptions = {},
): string {
  const { short = false, maxUnits = 2, showZero = false } = options;

  if (ms <= 0) {
    return showZero ? (short ? "0s" : "0 seconds") : "";
  }

  let remaining = ms;
  const parts: string[] = [];

  for (const { ms: unitMs, short: shortLabel, long: longLabel } of TIME_UNITS) {
    if (parts.length >= maxUnits) break;

    const value = Math.floor(remaining / unitMs);
    if (value > 0) {
      const label = short ? shortLabel : longLabel;
      const suffix = value === 1 ? "" : "s";
      parts.push(`${value}${short ? "" : " "}${label}${suffix}`);
      remaining -= value * unitMs;
    }
  }

  if (parts.length === 0 && showZero) {
    return short ? "0s" : "0 seconds";
  }

  return parts.join(short ? " " : ", ");
}

export function formatDurationShort(ms: number): string {
  return formatDuration(ms, { short: true, maxUnits: 2 });
}

export function formatDurationLong(ms: number): string {
  return formatDuration(ms, { short: false, maxUnits: 3 });
}

export function formatCooldown(seconds: number): string {
  return formatDuration(seconds * 1000, { short: true, maxUnits: 2 });
}

export function ordinal(num: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return `${num}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function formatPercentage(value: number, max: number, decimals = 0): string {
  if (max === 0) return "0%";
  const pct = (value / max) * 100;
  return `${pct.toFixed(decimals)}%`;
}

export function formatRatio(numerator: number, denominator: number): string {
  return `${formatCompactNumber(numerator)} / ${formatCompactNumber(denominator)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}