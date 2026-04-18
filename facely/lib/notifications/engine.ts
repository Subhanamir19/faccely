// lib/notifications/engine.ts
// Pure function — takes InsightData, returns the single highest-priority
// notification to show, or null if nothing is relevant.
// No side effects, no async, fully testable.

import type { InsightData } from "@/lib/api/insights";
import type { PulseType } from "@/components/ui/InsightPulseCard";

export interface NotificationPayload {
  type: PulseType;
  message: string;
  detail?: string;
  ctaLabel?: string;
  /** Opaque key used for cooldown tracking — changes when the underlying fact changes. */
  key: string;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minimum overall delta (points) to show a Momentum notification. */
const MOMENTUM_THRESHOLD = 2;

/** Minimum overall delta (points, negative) to show an Alert. */
const ALERT_THRESHOLD = -2;

/** Days since last scan before showing a Nudge. */
const NUDGE_DAYS = 3;

/** Minimum consecutive improving history points for an Insight. */
const INSIGHT_STREAK = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(isoString: string): number {
  const ms = Date.now() - new Date(isoString).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/** Best single improving metric label + delta, for use in message copy. */
function bestImprovingMetric(
  metrics: InsightData["insight"]["content"]["metrics"] | undefined,
): { label: string; delta: number } | null {
  if (!metrics) return null;
  const MAP: Record<string, string> = {
    jawline: "Jawline",
    facial_symmetry: "Facial symmetry",
    skin_quality: "Skin quality",
    cheekbones: "Cheekbones",
    eyes_symmetry: "Eye symmetry",
    nose_harmony: "Nose harmony",
    sexual_dimorphism: "Masculinity",
  };
  let best: { label: string; delta: number } | null = null;
  for (const [key, label] of Object.entries(MAP)) {
    const m = metrics[key as keyof typeof metrics];
    if (m?.verdict === "improved" && m.delta > (best?.delta ?? 0)) {
      best = { label, delta: m.delta };
    }
  }
  return best;
}

/** True if the last N graph_points are strictly increasing. */
function hasConsecutiveRise(points: number[], n: number): boolean {
  if (points.length < n) return false;
  const tail = points.slice(-n);
  for (let i = 1; i < tail.length; i++) {
    if (tail[i] <= tail[i - 1]) return false;
  }
  return true;
}

function round1(n: number): string {
  return Math.abs(n).toFixed(1);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Evaluate InsightData and return the single most relevant notification.
 * Priority order: Milestone > Momentum > Alert > Insight > Nudge.
 * Returns null when there is nothing worth surfacing.
 */
export function evaluateNotification(
  data: InsightData | null,
): NotificationPayload | null {
  if (!data) return null;

  const { insight, overall, scan_count, graph_points, history } = data;
  const content = insight?.content ?? null;

  // ── 1. Milestone ──────────────────────────────────────────────────────────
  // New personal best. Requires at least 2 scans so it's earned, not trivial.
  if (scan_count >= 2 && overall && overall.current > 0) {
    const isPersonalBest = overall.current >= overall.best && overall.best > 0;
    if (isPersonalBest) {
      return {
        type: "milestone",
        key: `milestone-${overall.current}`,
        message: `New personal best — overall score: ${overall.current.toFixed(1)} / 100`,
        detail: `You've hit your highest score yet. Keep the momentum going.`,
        ctaLabel: "See Full Report",
      };
    }
  }

  // ── 2. Momentum ───────────────────────────────────────────────────────────
  // Overall improved meaningfully since last scan.
  if (
    scan_count >= 2 &&
    content &&
    content.verdict === "improved" &&
    content.overall_delta >= MOMENTUM_THRESHOLD
  ) {
    const best = bestImprovingMetric(content.metrics);
    const message = best
      ? `${best.label} improved ${round1(best.delta)} pts — up ${round1(content.overall_delta)} overall`
      : `Overall score up ${round1(content.overall_delta)} pts since last scan`;

    return {
      type: "momentum",
      key: `momentum-${insight!.id}`,
      message,
      detail: `Based on your last 2 scans. Stay consistent with your routine.`,
      ctaLabel: "View Breakdown",
    };
  }

  // ── 3. Alert ──────────────────────────────────────────────────────────────
  // Overall score dropped meaningfully.
  if (
    scan_count >= 2 &&
    content &&
    content.verdict === "declined" &&
    content.overall_delta <= ALERT_THRESHOLD
  ) {
    return {
      type: "alert",
      key: `alert-${insight!.id}`,
      message: `Score dipped ${round1(content.overall_delta)} pts — check your routine`,
      detail: `Small drops are normal. Sleep, hydration, and lighting all affect scores. Scan again tomorrow.`,
      ctaLabel: "See What Changed",
    };
  }

  // ── 4. Insight ────────────────────────────────────────────────────────────
  // Consistent upward trend over last 3+ scans (no single-scan noise).
  if (
    scan_count >= INSIGHT_STREAK &&
    graph_points.length >= INSIGHT_STREAK &&
    hasConsecutiveRise(graph_points, INSIGHT_STREAK)
  ) {
    return {
      type: "insight",
      key: `insight-streak-${scan_count}`,
      message: `${INSIGHT_STREAK} scans in a row improving — your routine is working`,
      detail: `Consistent improvement signals real structural progress. Keep logging.`,
      ctaLabel: "View Trend",
    };
  }

  // ── 5. Nudge ──────────────────────────────────────────────────────────────
  // Haven't scanned recently enough. Only show if they have prior scans
  // (otherwise the onboarding flow handles first-scan prompting).
  if (scan_count >= 1 && history.length > 0) {
    const lastScan = history[0];
    const days = daysSince(lastScan.created_at);
    if (days >= NUDGE_DAYS) {
      const daysRounded = Math.floor(days);
      return {
        type: "nudge",
        key: `nudge-${daysRounded}d`,
        message: `It's been ${daysRounded} day${daysRounded !== 1 ? "s" : ""} since your last scan`,
        detail: undefined,
        ctaLabel: undefined,
      };
    }
  }

  return null;
}
