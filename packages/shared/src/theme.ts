// Design tokens taken from the reference UI: near-black background, charcoal cards,
// a soft blue accent and large rounded corners. Both apps read from here.

export const colors = {
  background: "#0E0F12",
  surface: "#17191E",
  surfaceRaised: "#1F2228",
  border: "#2A2E36",
  text: "#F5F6F8",
  textMuted: "#9AA0AA",
  textFaint: "#6B717C",
  primary: "#6EA8FE",
  primaryPressed: "#5A93E8",
  primarySoft: "#1E2B40",
  onPrimary: "#0E0F12",
  teal: "#2DD4BF",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  dangerSoft: "#3A1E22",
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
export const severityColors = [colors.success, colors.teal, colors.warning, "#FB923C", colors.danger] as const;
