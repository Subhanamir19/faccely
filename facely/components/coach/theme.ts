import { APP_SCREEN_BG } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";

/* ============================================================================
 * Coach surface tokens.
 *
 * Coach lives on the app's warm paper background, not on the dark surfaces used
 * by the scan and routine flows. The brand spec is explicit that lime is a
 * focal accent rather than a wash, so it appears in exactly three places here:
 * the send button, the active chip border, and a positive delta. Everything
 * else is paper, ink and hairlines.
 *
 * Neutrals are warm — mixed from the near-black ink over the cream ground —
 * because the cool greys in the light palette (#F2F3F5) read as dirty against
 * #FFF8EC.
 * ========================================================================== */

export const COACH = {
  /** Page ground, shared with every other tab. */
  bg: APP_SCREEN_BG,

  /** Cards, the composer, and the user's own bubbles. */
  surface: "#FFFFFF",
  surfaceMuted: "rgba(11,11,11,0.04)",
  border: "rgba(11,11,11,0.08)",
  hairline: "rgba(11,11,11,0.06)",

  ink: "#0B0B0B",
  inkMuted: "rgba(11,11,11,0.62)",
  inkFaint: "rgba(11,11,11,0.42)",

  accent: "#B4F34D",
  accentDeep: "#6B9A1E",
  accentSoft: "rgba(180,243,77,0.16)",

  /** Semantic coral, reserved for warnings. Never a second brand colour. */
  coral: "#E8734A",
  positive: "#4B8B2F",

  /** Score bands, matching the 0-100 system used across the app. */
  band: {
    elite: "#4B8B2F",
    great: "#6B9A1E",
    good: "#9AA81F",
    average: "#C8862A",
    poor: "#E8734A",
  },
} as const;

/** 4/8 spacing increments, per the design spec. */
export const COACH_SPACE = {
  pageMargin: 20,
  cardPadding: 16,
  gap: 12,
  gapLarge: 16,
  section: 24,
} as const;

export const COACH_RADIUS = {
  card: 18,
  bubble: 20,
  pill: 999,
  composer: 24,
} as const;

/**
 * Clearance above the floating tab bar.
 *
 * The bar floats over content rather than reserving space, so the thread and
 * composer have to leave room for it themselves.
 */
export const COACH_TAB_CLEARANCE = FLOATING_TAB_BAR.contentClearance;

/** Score to band colour. */
export function scoreBand(score: number): string {
  if (score >= 85) return COACH.band.elite;
  if (score >= 70) return COACH.band.great;
  if (score >= 55) return COACH.band.good;
  if (score >= 40) return COACH.band.average;
  return COACH.band.poor;
}
