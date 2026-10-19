// Design tokens: a white background, soft lavender cards and a light purple accent.
// Every screen reads its colors from here.

export const colors = {
  background: "#FFFFFF",
  surface: "#F6F3FE",
  surfaceRaised: "#ECE6FC",
  border: "#E2DAF7",
  text: "#1F1A33",
  textMuted: "#6B6582",
  textFaint: "#9C96B0",
  primary: "#8B6CEF",
  primaryPressed: "#7656E0",
  primarySoft: "#EEE8FE",
  onPrimary: "#FFFFFF",
  teal: "#0F9F8F",
  success: "#15803D",
  successSoft: "#E3F5E9",
  warning: "#B45309",
  warningSoft: "#FDF1DE",
  danger: "#DC2626",
  dangerSoft: "#FDE8E8",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Colors for severity levels 0 (minimal) to 4 (severe). */
export const severityColors = [colors.success, colors.teal, colors.warning, "#EA580C", colors.danger] as const;
