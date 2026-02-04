// lib/tokens.ts
// Centralized design tokens for liquid-brutalist / glassmorphism UI

export const COLORS = {
  // Background gradient
  bgTop: "#000000",
  bgBottom: "#0B0B0B",

  // Card glass
  card: "rgba(18,18,18,0.90)",        // #121212 @ 90%
  cardBorder: "rgba(255,255,255,0.08)",
  cardHairline: "rgba(255,255,255,0.05)",
  whiteGlass: "rgba(255,255,255,0.06)",
  inputBg: "rgba(18,18,18,0.90)",

  // Text hierarchy
  text: "#FFFFFF",
  textHigh: "rgba(255,255,255,0.92)",
  sub: "rgba(160,160,160,0.80)",
  muted: "rgba(200,200,200,0.70)",
  dim: "rgba(255,255,255,0.72)",

  // Brand accent
  accent: "#B4F34D",
  accentLight: "#C9FA69",
  accentDark: "#A6E03F",
  accentShadow: "rgba(180,243,77,0.25)",
  accentGlow: "rgba(180,243,77,0.18)",
  accentBorder: "rgba(180,243,77,0.30)",

  // UI neutrals
  track: "#2A2A2A",                     // progress inactive
  outline: "#2D2D2D",                   // borders for ghost buttons
  shadow: "rgba(0,0,0,0.70)",
  divider: "rgba(255,255,255,0.08)",

  // Button states
  btnDisabledBg: "#2A2A2A",
  btnDisabledText: "#7A7A7A",
  btnGhostBorder: "#2D2D2D",
  btnGhostText: "#EDEDED",

  // Option/radio states
  optionBg: "#1C1C1C",
  optionBgActive: "#151515",
  optionBorder: "#2D2D2D",
  optionText: "#EDEDED",
  optionTextActive: "#FFFFFF",

  // Status colors
  error: "#EF4444",
  errorLight: "#F97316",  // Orange - between error and warning
  warning: "#F59E0B",
  success: "#22C55E",

  // Sigma chat palette
  sigmaBg: "#000000",
  sigmaLime: "#B4F34D",
  sigmaWhite: "#FFFFFF",
  sigmaMuted: "#C7CBD1",
  sigmaGlass: "rgba(255,255,255,0.05)",
  sigmaBorder: "rgba(180,243,77,0.25)",
  sigmaGlow: "#B4F34D55",
  sigmaShadow: "#000000AA",
};

// Typography scale
export const TYPE = {
  // Headings
  h1: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Poppins-SemiBold",
  },
  h4: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Poppins-SemiBold",
  },
  // Body text
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Poppins-Regular",
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Poppins-Medium",
  },
  bodySemiBold: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Poppins-SemiBold",
  },
  // Small text
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-Regular",
  },
  captionMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-Medium",
  },
  captionSemiBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
  },
  // Extra small
  small: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Poppins-Regular",
  },
  smallSemiBold: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Poppins-SemiBold",
  },
  // Button text
  button: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Poppins-SemiBold",
  },
  buttonSmall: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
  },
  // Score display
  score: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "Poppins-SemiBold",
  },
  scoreLarge: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: "Poppins-SemiBold",
  },
} as const;

export type TypeVariant = keyof typeof TYPE;

export const RADII = {
  card: 32,
  pill: 28,
  xl: 24,
  lg: 18,
  md: 14,
  sm: 10,
  xs: 8,
  circle: 999,
};

export const SP = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const BLUR = {
  card: 15,
  light: 10,
  heavy: 20,
};

// Component sizes
export const SIZES = {
  avatarSm: 48,
  avatarMd: 72,
  avatarLg: 100,
  avatarXl: 140,
  progressBarSm: 4,
  progressBarMd: 5,
  progressBarLg: 6,
  progressBarXl: 8,
};

export const ELEVATION = {
  cardAndroid: 8,
  primaryBtnAndroid: 12,
  modalAndroid: 16,
};

export const SHADOWS = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  cardSubtle: {
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  primaryBtn: {
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  glowAccent: {
    shadowColor: COLORS.accent,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
};

// Onboarding flow configuration
export const ONBOARDING_FLOW = {
  steps: [
    { key: "welcome", label: "Welcome" },
    { key: "use-case", label: "Use Case" },
    { key: "experience", label: "Experience" },
    { key: "goals", label: "Goals" },
    { key: "age", label: "Age" },
    { key: "ethnicity", label: "Ethnicity" },
    { key: "gender", label: "Gender" },
    { key: "edge", label: "Edge" },
    { key: "trust", label: "Trust" },
    { key: "paywall", label: "Paywall" },
  ],
  // Total steps excluding welcome and paywall for progress calculation
  totalProgressSteps: 8,
} as const;

export function getProgressForStep(stepKey: string): number {
  const idx = ONBOARDING_FLOW.steps.findIndex((s) => s.key === stepKey);
  if (idx <= 0) return 0; // welcome has no progress
  if (stepKey === "paywall") return 1; // paywall is 100%
  // Exclude welcome (idx 0) and paywall from calculation
  return idx / ONBOARDING_FLOW.totalProgressSteps;
}
