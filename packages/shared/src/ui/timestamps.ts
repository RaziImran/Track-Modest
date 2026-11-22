export type TimestampStyle =
  | "t" // Short Time: 16:20
  | "T" // Long Time: 16:20:30
  | "d" // Short Date: 20/04/2021
  | "D" // Long Date: 20 April 2021
  | "f" // Short Date/Time: 20 April 2021 16:20
  | "F" // Long Date/Time: Tuesday, 20 April 2021 16:20
  | "R"; // Relative: 2 months ago / in 2 months

export interface TimestampOptions {
  style?: TimestampStyle;
}

export function timestamp(unixSeconds: number, options: TimestampOptions = {}): string {
  const { style = "f" } = options;
  return `<t:${unixSeconds}:${style}>`;
}

export function timestampRelative(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "R" });
}

export function timestampShortDateTime(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "f" });
}

export function timestampLongDateTime(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "F" });
}

export function timestampShortDate(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "d" });
}

export function timestampLongDate(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "D" });
}

export function timestampShortTime(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "t" });
}

export function timestampLongTime(unixSeconds: number): string {
  return timestamp(unixSeconds, { style: "T" });
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function fromDate(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function fromMs(milliseconds: number): number {
  return Math.floor(milliseconds / 1000);
}

export function toDate(unixSeconds: number): Date {
  return new Date(unixSeconds * 1000);
}

export function addSeconds(unixSeconds: number, seconds: number): number {
  return unixSeconds + seconds;
}

export function addMinutes(unixSeconds: number, minutes: number): number {
  return unixSeconds + minutes * 60;
}

export function addHours(unixSeconds: number, hours: number): number {
  return unixSeconds + hours * 3600;
}

export function addDays(unixSeconds: number, days: number): number {
  return unixSeconds + days * 86400;
}

export function addWeeks(unixSeconds: number, weeks: number): number {
  return unixSeconds + weeks * 604800;
}

export function addMonths(unixSeconds: number, months: number): number {
  const date = toDate(unixSeconds);
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const originalDate = date.getDate();
  date.setFullYear(targetYear, normalizedMonth, 1);
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  date.setDate(Math.min(originalDate, lastDayOfTargetMonth));
  return fromDate(date);
}

export function addYears(unixSeconds: number, years: number): number {
  const date = toDate(unixSeconds);
  date.setFullYear(date.getFullYear() + years);
  return fromDate(date);
}

export function diffInSeconds(from: number, to: number = now()): number {
  return to - from;
}

export function diffInMinutes(from: number, to: number = now()): number {
  return Math.floor(diffInSeconds(from, to) / 60);
}

export function diffInHours(from: number, to: number = now()): number {
  return Math.floor(diffInSeconds(from, to) / 3600);
}

export function diffInDays(from: number, to: number = now()): number {
  return Math.floor(diffInSeconds(from, to) / 86400);
}

export function isPast(unixSeconds: number, reference: number = now()): boolean {
  return unixSeconds < reference;
}

export function isFuture(unixSeconds: number, reference: number = now()): boolean {
  return unixSeconds > reference;
}

export function isWithin(unixSeconds: number, windowSeconds: number, reference: number = now()): boolean {
  return Math.abs(unixSeconds - reference) <= windowSeconds;
}

export function formatTimeUntil(target: number, reference: number = now()): string {
  const diff = target - reference;
  if (diff <= 0) return "now";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);
  if (seconds > 0 && parts.length < 2) parts.push(`${seconds}s`);

  return parts.join(" ") || "< 1m";
}

export function formatTimeSince(from: number, reference: number = now()): string {
  const diff = reference - from;
  if (diff <= 0) return "just now";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function dailyResetTimestamp(hour = 0, minute = 0, second = 0, timezoneOffsetMinutes = 0): number {
  const now = Date.now();
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const localNow = new Date(now + offsetMs);

  localNow.setUTCHours(hour, minute, second, 0);

  if (localNow.getTime() <= now + offsetMs) {
    localNow.setUTCDate(localNow.getUTCDate() + 1);
  }

  return Math.floor((localNow.getTime() - offsetMs) / 1000);
}

export function weeklyResetTimestamp(dayOfWeek = 0, hour = 0, minute = 0, second = 0, timezoneOffsetMinutes = 0): number {
  const now = Date.now();
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const localNow = new Date(now + offsetMs);

  const currentDay = localNow.getUTCDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;

  localNow.setUTCDate(localNow.getUTCDate() + daysUntilTarget);
  localNow.setUTCHours(hour, minute, second, 0);

  return Math.floor((localNow.getTime() - offsetMs) / 1000);
}

export function monthlyResetTimestamp(day = 1, hour = 0, minute = 0, second = 0, timezoneOffsetMinutes = 0): number {
  const now = Date.now();
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const localNow = new Date(now + offsetMs);

  localNow.setUTCDate(day);
  localNow.setUTCHours(hour, minute, second, 0);

  if (localNow.getTime() <= now + offsetMs) {
    localNow.setUTCMonth(localNow.getUTCMonth() + 1);
  }

  return Math.floor((localNow.getTime() - offsetMs) / 1000);
}

export function seasonalResetTimestamp(
  seasonStartMonth: number,
  seasonStartDay: number,
  hour = 0,
  minute = 0,
  second = 0,
  timezoneOffsetMinutes = 0,
): number {
  const now = Date.now();
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const localNow = new Date(now + offsetMs);

  const currentYear = localNow.getUTCFullYear();
  let target = new Date(Date.UTC(currentYear, seasonStartMonth - 1, seasonStartDay, hour, minute, second));

  if (target.getTime() <= now + offsetMs) {
    target = new Date(Date.UTC(currentYear + 1, seasonStartMonth - 1, seasonStartDay, hour, minute, second));
  }

  return Math.floor((target.getTime() - offsetMs) / 1000);
}