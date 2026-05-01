// components/dashboard/PotentialFaceCard.tsx
//
// Top-of-dashboard component: Current ↔ Potential face + "% closer" bar.
// Tap-to-expand opens a per-metric breakdown modal.
//
// State machine driven by the persisted potentialFace store:
//   data == null              → render nothing (parent decides emptiness)
//   data.status === "pending" → "Generating your potential face…" placeholder,
//                                  polls /current every 5s while visible
//   data.status === "failed"  → error chip with retry hint
//   data.status === "ready"   → full reveal layout
//   data.status === "ready" + days-since-last-scan > 60
//                             → swap progress block for "Scan again" CTA
//   data.status === "unlocked" → not normally reached (server-side `getActive…`
//                                  filters unlocked); if it does, render nothing.
//
// Image policy:
//   • Left  = useScores().imageUri (latest local capture). Falls back to a
//     placeholder when the user hasn't scanned this session — by design we
//     don't fetch remote scan-history images here; the visual blank is fine
//     for the rare cold-start-without-scan case.
//   • Right = potentialFace.primaryImageUrl (signed URL, ~6h TTL). The
//     parent calls `load()` on focus to mint fresh URLs.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { ChevronRight, X } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticLight } from "@/lib/haptics";
import { labelForMetric } from "@/lib/potentialFaceLabels";

import {
  usePotentialFace,
  computeProgressPercent,
  type PotentialFace,
  type TargetedMetric,
} from "@/store/potentialFace";
import type { LatestAdvanced } from "@/lib/api/insights";

const FONT = "ProximaNova-Bold";

const STALE_DAYS = 60;
const PENDING_POLL_MS = 5_000;

/* -------------------------------------------------------------------------- */
/*   Props                                                                    */
/* -------------------------------------------------------------------------- */

export interface PotentialFaceCardProps {
  /** Local URI of the user's most recent scan front photo, if any. */
  currentImageUri: string | null;
  /** Latest advanced analysis, used to compute current sub-metric values. */
  latestAdvanced: LatestAdvanced | null;
  /**
   * Days since the user's most recent scan. Drives the stale-state CTA. Pass
   * `null` when there's no scan history (the card just won't show stale).
   */
  daysSinceLastScan: number | null;
  /** Tapped when the user is in the stale state. */
  onScanAgain: () => void;
}

/* -------------------------------------------------------------------------- */
/*   Component                                                                */
/* -------------------------------------------------------------------------- */

export function PotentialFaceCard(props: PotentialFaceCardProps) {
  const { currentImageUri, latestAdvanced, daysSinceLastScan, onScanAgain } = props;

  const data = usePotentialFace((s) => s.data);
  const load = usePotentialFace((s) => s.load);

  const [detailOpen, setDetailOpen] = useState(false);

  /* ------------------------------------------------------------------------ */
  /*   Lifecycle                                                              */
  /* ------------------------------------------------------------------------ */

  // On mount, kick a load to refresh signed URLs. Persisted state means the
  // card renders instantly; the load() updates URLs in the background.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While status is pending, poll /current every 5s. Stops automatically when
  // status flips to a terminal value or the component unmounts.
  const status = data?.status;
  useEffect(() => {
    if (status !== "pending") return;
    const id = setInterval(() => void load(), PENDING_POLL_MS);
    return () => clearInterval(id);
  }, [status, load]);

  /* ------------------------------------------------------------------------ */
  /*   Render branches                                                        */
  /* ------------------------------------------------------------------------ */

  if (!data || data.status === "unlocked") return null;

  if (data.status === "pending") {
    return <PendingCard />;
  }

  if (data.status === "failed") {
    return <FailedCard reason={data.errorReason} />;
  }

  // status === "ready"
  const isStale =
    typeof daysSinceLastScan === "number" && daysSinceLastScan > STALE_DAYS;
  const progress = computeProgressPercent(data, latestAdvanced); // 0..1 | null

  return (
    <>
      <ReadyCard
        potentialFace={data}
        currentImageUri={currentImageUri}
        progress={progress}
        isStale={isStale}
        onPress={() => {
          hapticLight();
          setDetailOpen(true);
        }}
        onScanAgain={onScanAgain}
      />
      <DetailModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        potentialFace={data}
        latestAdvanced={latestAdvanced}
        progress={progress}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*   Ready                                                                    */
/* -------------------------------------------------------------------------- */

function ReadyCard({
  potentialFace,
  currentImageUri,
  progress,
  isStale,
  onPress,
  onScanAgain,
}: {
  potentialFace: PotentialFace;
  currentImageUri: string | null;
  progress: number | null;
  isStale: boolean;
  onPress: () => void;
  onScanAgain: () => void;
}) {
  const { width: SW } = useWindowDimensions();
  const cardPad = SP[4];
  const innerWidth = SW - SP[5] * 2 - cardPad * 2; // dashboard outer pad + card pad
  const gap = sw(10);
  const imageHeight = ms(150);
  const imageWidth = (innerWidth - gap) / 2;

  const pct = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.cardOuter}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Open potential face details"
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <T style={styles.eyebrow}>STAGE {potentialFace.stage}</T>
            <T style={styles.headerTitle}>Your potential</T>
          </View>
          <ChevronRight size={ms(18)} color={COLORS.lightSub} />
        </View>

        {/* Two-up images */}
        <View style={[styles.compareRow, { gap }]}>
          <CompareCell
            uri={currentImageUri}
            label="You today"
            width={imageWidth}
            height={imageHeight}
            accent={false}
          />
          <CompareCell
            uri={potentialFace.primaryImageUrl}
            label="Potential"
            width={imageWidth}
            height={imageHeight}
            accent
          />
        </View>

        {/* Progress block — swapped for "Scan again" when stale */}
        {isStale ? (
          <Pressable
            onPress={onScanAgain}
            style={({ pressed }) => [styles.staleCta, pressed && { opacity: 0.92 }]}
          >
            <T style={styles.staleText}>Scan again to see your progress</T>
            <ChevronRight size={ms(16)} color={COLORS.lightText} />
          </Pressable>
        ) : (
          <ProgressBlock pct={pct} />
        )}
      </Pressable>
    </Animated.View>
  );
}

function CompareCell({
  uri,
  label,
  width,
  height,
  accent,
}: {
  uri: string | null;
  label: string;
  width: number;
  height: number;
  accent: boolean;
}) {
  return (
    <View style={styles.compareCol}>
      <View
        style={[
          styles.imageCard,
          accent && styles.imageCardAccent,
          { width, height },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.imagePlaceholder]} />
        )}
      </View>
      <T style={[styles.imageLabel, accent && styles.imageLabelAccent]}>{label}</T>
    </View>
  );
}

function ProgressBlock({ pct }: { pct: number | null }) {
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <T style={styles.progressNumber}>{pct === null ? "—" : `${pct}%`}</T>
        <T style={styles.progressCaption}>
          {pct === null ? "tracking your progress" : "closer to your potential"}
        </T>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct ?? 0}%` },
          ]}
        />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Pending                                                                  */
/* -------------------------------------------------------------------------- */

function PendingCard() {
  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.cardOuter}>
      <View style={[styles.card, styles.pendingCard]}>
        <ActivityIndicator color={COLORS.lightText} />
        <View style={{ flex: 1 }}>
          <T style={styles.pendingTitle}>Generating your potential face</T>
          <T style={styles.pendingSubtitle}>
            We'll have it ready in just a moment.
          </T>
        </View>
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Failed                                                                   */
/* -------------------------------------------------------------------------- */

function FailedCard({ reason }: { reason: string | null }) {
  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.cardOuter}>
      <View style={[styles.card, styles.failedCard]}>
        <T style={styles.failedTitle}>Potential face is being prepared</T>
        <T style={styles.failedBody}>
          {reason && reason.startsWith("missing_advanced_analysis")
            ? "Run advanced analysis on a recent scan to generate your potential face."
            : "We'll retry shortly. Check back in a moment."}
        </T>
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Detail modal                                                             */
/* -------------------------------------------------------------------------- */

function DetailModal({
  visible,
  onClose,
  potentialFace,
  latestAdvanced,
  progress,
}: {
  visible: boolean;
  onClose: () => void;
  potentialFace: PotentialFace;
  latestAdvanced: LatestAdvanced | null;
  progress: number | null;
}) {
  const insets = useRef({ top: 0 }).current; // simple, the sheet floats — no need for SafeArea
  const breakdown = useMemo(
    () => buildPerMetricBreakdown(potentialFace.targetedMetrics, latestAdvanced),
    [potentialFace.targetedMetrics, latestAdvanced]
  );
  const overallPct = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
        onPress={onClose}
      />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <T style={styles.sheetEyebrow}>STAGE {potentialFace.stage}</T>
              <T style={styles.sheetTitle}>
                {overallPct === null ? "Your potential" : `${overallPct}% closer`}
              </T>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={ms(20)} color={COLORS.lightText} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            {breakdown.map((row, idx) => (
              <View key={`${row.key}-${idx}`} style={styles.metricRow}>
                <View style={styles.metricRowHeader}>
                  <T style={styles.metricLabel}>{row.label}</T>
                  <T style={styles.metricDelta}>
                    {row.current === null
                      ? "—"
                      : row.current >= row.target
                        ? "✓ at target"
                        : `${Math.round(row.ratio * 100)}%`}
                  </T>
                </View>
                <View style={styles.metricTrack}>
                  <View
                    style={[
                      styles.metricFill,
                      { width: `${Math.round(row.ratio * 100)}%` },
                    ]}
                  />
                </View>
                <View style={styles.metricFooter}>
                  <T style={styles.metricFootText}>baseline {row.baseline}</T>
                  <T style={styles.metricFootText}>
                    now {row.current === null ? "—" : Math.round(row.current)}
                  </T>
                  <T style={styles.metricFootText}>target {row.target}</T>
                </View>
              </View>
            ))}

            <T style={styles.sheetFootnote}>
              Progress is the average movement of the metrics this image was
              built around. Re-scan to see it tick up.
            </T>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface BreakdownRow {
  key: string;
  label: string;
  baseline: number;
  current: number | null;
  target: number;
  /** clamp((current - baseline) / (target - baseline), 0, 1) */
  ratio: number;
}

function buildPerMetricBreakdown(
  targets: TargetedMetric[],
  latestAdvanced: LatestAdvanced | null
): BreakdownRow[] {
  return targets.map((m) => {
    const groupVal = (latestAdvanced ?? {}) as Record<string, unknown>;
    const group = groupVal[m.group] as Record<string, unknown> | undefined;
    const raw = group ? group[m.sub_metric] : undefined;
    const current =
      typeof raw === "number" && Number.isFinite(raw) ? raw : null;

    let ratio = 0;
    const span = m.target_score - m.baseline_score;
    if (current !== null) {
      if (span <= 0) ratio = current >= m.target_score ? 1 : 0;
      else ratio = Math.max(0, Math.min(1, (current - m.baseline_score) / span));
    }
    return {
      key: `${m.group}.${m.sub_metric}`,
      label: labelForMetric(m),
      baseline: m.baseline_score,
      current,
      target: m.target_score,
      ratio,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*   Styles                                                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  cardOuter: {
    paddingHorizontal: SP[5],
    marginBottom: SP[4],
  },
  card: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    padding: SP[4],
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    gap: sh(14),
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    gap: sh(2),
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: COLORS.accentDepth,
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: ms(18),
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },

  /* Compare */
  compareRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  compareCol: {
    alignItems: "center",
    gap: sh(6),
  },
  imageCard: {
    borderRadius: RADII.md,
    overflow: "hidden",
    backgroundColor: COLORS.lightSurface,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
  imageCardAccent: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  imageLabel: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 1,
  },
  imageLabelAccent: {
    color: COLORS.accentDepth,
  },

  /* Progress */
  progressBlock: {
    gap: sh(8),
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: sw(8),
  },
  progressNumber: {
    fontFamily: FONT,
    fontSize: ms(28),
    color: COLORS.lightText,
    letterSpacing: -0.5,
  },
  progressCaption: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
  },
  progressTrack: {
    height: sh(8),
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 999,
  },

  /* Stale CTA */
  staleCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: sh(12),
    paddingHorizontal: SP[3],
    borderRadius: RADII.md,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  staleText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightText,
  },

  /* Pending */
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },
  pendingTitle: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  pendingSubtitle: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },

  /* Failed */
  failedCard: {
    gap: sh(4),
  },
  failedTitle: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  failedBody: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    lineHeight: ms(16),
  },

  /* Modal */
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.lightBg,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    paddingHorizontal: SP[5],
    paddingTop: sh(8),
    paddingBottom: SP[5],
    maxHeight: "78%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: sw(40),
    height: sh(4),
    borderRadius: 999,
    backgroundColor: COLORS.lightBorder,
    marginBottom: SP[3],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SP[4],
  },
  sheetEyebrow: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: COLORS.accentDepth,
    letterSpacing: 1.4,
  },
  sheetTitle: {
    fontFamily: FONT,
    fontSize: ms(22),
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  sheetScroll: {
    paddingBottom: SP[4],
    gap: sh(18),
  },
  metricRow: {
    gap: sh(6),
  },
  metricRowHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  metricDelta: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.accentDepth,
  },
  metricTrack: {
    height: sh(6),
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden",
  },
  metricFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 999,
  },
  metricFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: sh(2),
  },
  metricFootText: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
  },
  sheetFootnote: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    lineHeight: ms(15),
    marginTop: SP[3],
    textAlign: "center",
  },
});
