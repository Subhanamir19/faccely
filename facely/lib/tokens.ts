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
  accentDepth: "#6B9A1E",             // 3D button shadow / depth base
  accentShadow: "rgba(180,243,77,0.25)",
  accentGlow: "rgba(180,243,77,0.18)",
  accentBorder: "rgba(180,243,77,0.30)",
  modalBackdrop: "rgba(0,0,0,0.80)",  // standard modal overlay

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

  // Verdict tier colors (best → worst)
  verdictElite: "#7DFF6A",
  verdictGreat: "#A8F059",
  verdictGood: "#C8DA45",
  verdictAverage: "#F5C842",
  verdictPoor: "#F08C5A",

  // Light surfaces (routine preview / list)
  lightBg:           "#FFFFFF",
  lightCard:         "#FAFBFC",   // dim-white card surface, barely off pure white
  lightSurface:      "#F2F3F5",
  lightSurfaceAlt:   "#EFEFEF",
  lightChipBg:       "#FFFFFF",
  lightBorder:       "#E6E6E8",
  lightHairline:     "rgba(0,0,0,0.08)",
  lightDivider:      "rgba(0,0,0,0.06)",
  lightText:         "#0B0B0B",
  lightSub:          "#8A8A8E",
  lightMuted:        "#6E6E73",
  iconTileLavender:  "#EFEAF7",
  ctaBlack:          "#000000",
  ctaBlackPressed:   "#1A1A1A",

  // Direction semantics — used wherever a delta needs colour.
  declineRed:        "#E5484D",   // warm red, not alarm
  declineRedSoft:    "#FCE4E5",   // pale tint for chip backgrounds on light bg

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
  // Proxima Nova (display) — used by the light routine-preview surface
  proximaScreenTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "ProximaNova-Bold",
    letterSpacing: -0.5,
  },
  proximaSection: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: "ProximaNova-Bold",
    letterSpacing: -0.4,
  },
  proximaStatNum: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "ProximaNova-Bold",
    letterSpacing: -0.4,
  },
  proximaExerciseTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "ProximaNova-Bold",
    letterSpacing: 0.2,
  },
  proximaPill: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "ProximaNova-Bold",
    letterSpacing: 0.1,
  },
  proximaCta: {
    fontSize: 17,
    lineHeight: 20,
    fontFamily: "ProximaNova-Bold",
    letterSpacing: 0.6,
  },
  proximaStepper: {
    fontSize: 17,
    lineHeight: 20,
    fontFamily: "ProximaNova-Bold",
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

// Onboarding flow configuration — the canonical user-facing sequence.
// Order here is authoritative; the progress bar fills linearly across it.
// Orphan/alt screens (hook, intro, welcome, experience, face-scan, results-reveal,
// building-plan, reviews) map to a sibling via PROGRESS_ALIASES below.
export const ONBOARDING_FLOW = {
  steps: [
    { key: "splash", label: "Splash" },
    { key: "random-glowup", label: "Random Glowup" },
    { key: "sigma-choice", label: "SigmaMax Choice" },
    { key: "feature-sequence", label: "Feature Sequence" },
    { key: "warmup", label: "Warmup" },
    { key: "goals", label: "Goals" },
    { key: "gender", label: "Gender" },
    { key: "age", label: "Birthday" },
    { key: "ethnicity", label: "Ethnicity" },
    { key: "scan", label: "Scan" },
    { key: "studies", label: "Studies" },
    { key: "plan-impact", label: "Plan Impact" },
    { key: "time-dedication", label: "Time Dedication" },
    { key: "score-projection", label: "Score Projection" },
    { key: "weak-points-locked", label: "Locked Findings" },
    { key: "paywall", label: "Paywall" },
    { key: "plan-intro", label: "Plan Intro" },
    { key: "routine-animation", label: "Routine Animation" },
  ],
} as const;

// Orphans / alt entries resolve to the step they visually follow.
const PROGRESS_ALIASES: Record<string, string> = {
  "face-scan": "scan",
  "results-reveal": "plan-intro",
  "building-plan": "score-projection",
  features: "score-projection",
  reviews: "score-projection",
  experience: "goals",
  intro: "splash",
  hook: "splash",
  welcome: "splash",
};

export function getProgressForStep(stepKey: string): number {
  const key = PROGRESS_ALIASES[stepKey] ?? stepKey;
  const idx = ONBOARDING_FLOW.steps.findIndex((s) => s.key === key);
  if (idx <= 0) return 0; // splash (or unknown) has no progress
  const last = ONBOARDING_FLOW.steps.length - 1;
  return Math.min(1, idx / last);
}

// ---------------------------------------------------------------------------
// Onboarding background moods
// ---------------------------------------------------------------------------
// The onboarding flow uses one shell colour for every screen. Screens that
// carry an emotional beat lay a vertical tint over it; the tint fades back into
// that same shell before the CTA, so consecutive screens read as one surface
// rather than a set of differently-coloured pages. Question and input screens
// take the shell flat.
//
// Provenance matters here, because the two groups were derived differently:
//   - ONBOARDING_SURFACE values are pixel samples measured from the reference
//     recording (see reference-style-for-options-asset.json). The one exception
//     is `shell`: the measured value is the cool grey #E8E7EE, warmed here so it
//     sits under the brand orange #F26A13 without going muddy.
//   - BG_MOODS tints are visual estimates read off the reference screens, not
//     sampled pixels. Treat them as ±3 per channel.
export const ONBOARDING_SURFACE = {
  shell: "#EDEBE7",          // every screen's base; also every gradient's end stop
  card: "#FDFDFD",           // question bubbles, option rows, result cards
  cardSelected: "#E8F3E8",   // chosen option fill
  indicatorEmpty: "#E5E4E7", // unselected radio / checkbox
  ink: "#181818",            // primary text and the CTA pill
  inkMuted: "#808080",       // captions, helper copy
  progressTrack: "#FFFFFF",
  progressFill: "#35AB4A",
  selection: "#40A653",      // selected border, check glyph, badge fill
} as const;

// Shared gradient geometry. The tint holds through the headline, then releases
// into the shell well above the CTA so the button never sits on colour.
export const BG_MOOD_GRADIENT = {
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
  locations: [0, 0.38, 0.88] as const,
};

// Each mood is [top, mid, bottom]. `bottom` is always the shell.
export const BG_MOODS = {
  // Flat shell, for screens that must carry no tint at all.
  neutral: { top: "#EDEBE7", mid: "#EDEBE7", bottom: "#EDEBE7" },
  // Question and input screens: a whisper of brand orange, gone before the
  // options, so the chosen answer stays the only strong colour event.
  peach: { top: "#FCEADC", mid: "#F3E9E1", bottom: "#EDEBE7" },
  // New chapter, curiosity, neutral topic hand-off.
  cool: { top: "#DDE3F7", mid: "#E4E6F0", bottom: "#EDEBE7" },
  // Affirmation, warmth, emotional payoff.
  warm: { top: "#FBDBD1", mid: "#F4DFD8", bottom: "#EDEBE7" },
  // Success, plan ready, projection.
  mint: { top: "#E4F1E2", mid: "#E9F1E4", bottom: "#EDEBE7" },
  // Attention and diagnosis — weak points, score breakdowns. Not failure.
  amber: { top: "#FBEBCF", mid: "#F4EADB", bottom: "#EDEBE7" },
  // Analysis and AI.
  violet: { top: "#E7E1F7", mid: "#E9E5F1", bottom: "#EDEBE7" },
} as const;

export type BgMood = keyof typeof BG_MOODS;

export function getBgMood(mood: BgMood) {
  return BG_MOODS[mood];
}
