// lib/tokens.ts
// Centralized design tokens for liquid-brutalist / glassmorphism UI

export const COLORS = {
  // Background gradient
  bgTop: "#000000",
  bgBottom: "#0B0B0B",

  // Sigma chat palette
  sigmaBg: "#000000",
  sigmaLime: "#B4F34D",
  sigmaWhite: "#FFFFFF",
  sigmaMuted: "#C7CBD1",
  sigmaGlass: "rgba(255,255,255,0.05)",
  sigmaBorder: "rgba(180,243,77,0.25)",
  sigmaGlow: "#B4F34D55",
  sigmaShadow: "#000000AA",

  // Card glass
  card: "rgba(18,18,18,0.90)",        // #121212 @ 90%
  cardBorder: "rgba(255,255,255,0.08)",
  whiteGlass: "rgba(255,255,255,0.06)",
  inputBg: "rgba(18,18,18,0.90)",

  // Text
  text: "#FFFFFF",
  sub: "rgba(160,160,160,0.80)",

  // Brand accent
  accent: "#B4F34D",
  accentShadow: "rgba(180,243,77,0.25)", // for soft outer glow

  // UI neutrals
  track: "#2A2A2A",                     // progress inactive
  outline: "#2D2D2D",                   // borders for ghost buttons
  shadow: "rgba(0,0,0,0.70)",
};

export const RADII = {
  card: 32,
  pill: 28,
  xl: 24,
  lg: 18,
  md: 14,
  sm: 10,
  circle: 999,
};

export const SP = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 };

export const BLUR = {
  card: 15, // Gaussian blur behind glass cards
};

export const ELEVATION = {
  cardAndroid: 8,
  primaryBtnAndroid: 6,
};

export const SHADOWS = {
  cardIOS: {
    color: "#000000",
    opacity: 0.35,
    radius: 30,
    offset: { width: 0, height: 18 },
  },
  primaryIOS: {
    color: COLORS.accent,
    opacity: 0.25,
    radius: 15,
    offset: { width: 0, height: 2 },
  },
};
