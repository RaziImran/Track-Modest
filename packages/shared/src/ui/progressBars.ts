export interface ProgressBarOptions {
  filled?: string;
  empty?: string;
  leftCap?: string;
  rightCap?: string;
  showPercentage?: boolean;
  width?: number;
}

const DEFAULT_OPTIONS: Required<ProgressBarOptions> = {
  filled: "▰",
  empty: "▱",
  leftCap: "",
  rightCap: "",
  showPercentage: true,
  width: 10,
};

const EMOJI_OPTIONS: Required<ProgressBarOptions> = {
  filled: "<:progress_filled:1234567890123456789>",
  empty: "<:progress_empty:1234567890123456789>",
  leftCap: "<:progress_left:1234567890123456789>",
  rightCap: "<:progress_right:1234567890123456789>",
  showPercentage: true,
  width: 10,
};

export function progressBar(
  value: number,
  max: number,
  options: ProgressBarOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { filled, empty, leftCap, rightCap, showPercentage, width } = opts;

  if (max <= 0) {
    return leftCap + empty.repeat(width) + rightCap + (showPercentage ? " 0%" : "");
  }

  const clampedValue = Math.max(0, Math.min(value, max));
  const percentage = clampedValue / max;
  const filledCount = Math.round(percentage * width);
  const emptyCount = width - filledCount;

  let bar = leftCap + filled.repeat(filledCount) + empty.repeat(emptyCount) + rightCap;

  if (showPercentage) {
    const pct = Math.round(percentage * 100);
    bar += ` ${pct}%`;
  }

  return bar;
}

export function progressBarEmoji(
  value: number,
  max: number,
  options: ProgressBarOptions = {},
): string {
  const opts = { ...EMOJI_OPTIONS, ...options };
  return progressBar(value, max, opts);
}

export function progressBarWithFallback(
  value: number,
  max: number,
  customEmoji: { filled: string; empty: string; leftCap?: string; rightCap?: string } | null,
  options: ProgressBarOptions = {},
): string {
  if (customEmoji) {
    return progressBar(value, max, { ...options, ...customEmoji });
  }
  return progressBar(value, max, options);
}

export function xpProgressBar(
  currentXp: number,
  xpForNextLevel: number,
  options: ProgressBarOptions = {},
): string {
  return progressBar(currentXp, xpForNextLevel, {
    width: 12,
    filled: options.filled ?? "▰",
    empty: options.empty ?? "▱",
    showPercentage: true,
    ...options,
  });
}

export function streakProgressBar(
  currentDay: number,
  targetDay: number,
  options: ProgressBarOptions = {},
): string {
  return progressBar(currentDay, targetDay, {
    width: 10,
    filled: "🔥",
    empty: "⬜",
    showPercentage: false,
    ...options,
  });
}

export function circularProgressBar(
  percentage: number,
  size: "small" | "medium" | "large" = "medium",
): string {
  const segments = {
    small: 8,
    medium: 12,
    large: 16,
  }[size];

  const filledCount = Math.round((percentage / 100) * segments);
  const emptyCount = segments - filledCount;

  return "●".repeat(filledCount) + "○".repeat(emptyCount);
}

export function multiSegmentBar(
  segments: Array<{ value: number; max: number; label?: string; color?: string }>,
  totalWidth: number = 20,
): string {
  if (segments.length === 0) return "";

  const totalMax = segments.reduce((sum, s) => sum + s.max, 0);
  if (totalMax === 0) return "▱".repeat(totalWidth);

  let result = "";
  let remainingWidth = totalWidth;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const segmentWidth = i === segments.length - 1
      ? remainingWidth
      : Math.max(1, Math.round((segment.max / totalMax) * totalWidth));

    remainingWidth -= segmentWidth;
    const filledCount = Math.round((segment.value / segment.max) * segmentWidth);
    const emptyCount = segmentWidth - filledCount;

    const filled = segment.color ? `█` : "▰";
    const empty = "▱";

    result += filled.repeat(filledCount) + empty.repeat(emptyCount);
  }

  return result;
}