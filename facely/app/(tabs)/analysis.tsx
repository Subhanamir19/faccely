// app/(tabs)/analysis.tsx
// Premium face analysis screen with polished UI/UX

import React, { useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Platform,
} from "react-native";
import PagerView from "react-native-pager-view";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import AnalysisCard, { type SubmetricView } from "@/components/analysis/AnalysisCard";
import MetricCardShell from "@/components/layout/MetricCardShell";
import MetricPagerFooter from "@/components/layout/MetricPagerFooter";
import StateView from "@/components/layout/StateView";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import useMetricSizing from "@/components/layout/useMetricSizing.ts";

import Text from "@/components/ui/T";
import { useScores, getSubmetricVerdicts } from "../../store/scores";
import { useRouter } from "expo-router";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
type MetricKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism";

const ORDER: MetricKey[] = [
  "eyes_symmetry",
  "jawline",
  "cheekbones",
  "nose_harmony",
  "facial_symmetry",
  "skin_quality",
  "sexual_dimorphism",
];

const LABELS: Record<MetricKey, string> = {
  jawline: "Jawline",
  facial_symmetry: "Symmetry",
  skin_quality: "Skin Quality",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eyes",
  nose_harmony: "Nose",
  sexual_dimorphism: "Masculinity",
};

const SUBMETRICS: Record<MetricKey, [string, string, string, string]> = {
  eyes_symmetry: ["Shape", "Symmetry", "Canthal Tilt", "Color"],
  jawline: ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  cheekbones: ["Definition", "Face Fat", "Maxilla Development", "Bizygomatic Width"],
  nose_harmony: ["Nose Shape", "Straightness", "Nose Balance", "Nose Tip Type"],
  skin_quality: ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  facial_symmetry: ["Horizontal Alignment", "Vertical Balance", "Eye-Line Level", "Nose-Line Centering"],
  sexual_dimorphism: ["Face Power", "Hormone Balance", "Contour Strength", "Softness Level"],
};

// ── Responsive constants ─────────────────────────────────────────
const SCORE_BADGE_SIZE = ms(56, 0.6);
const SCORE_FONT = ms(21, 0.5);
const HEADER_PAD_H = sw(16);
const HEADER_PAD_TOP = sh(4);
const HEADER_PAD_BOTTOM = sh(8);
const HEADER_GAP = sh(4);
const TITLE_FONT = ms(20, 0.3);
const POSITION_FONT = ms(11, 0.3);
const POSITION_PAD_H = sw(10);
const POSITION_PAD_V = sh(3);
const GLOW_H = sh(260);
const FOOTER_PAD_TOP = sh(4);

// Score color tiers
function getScoreColor(score: number): string {
  if (score <= 39) return COLORS.error;
  if (score <= 59) return COLORS.errorLight;
  if (score <= 79) return COLORS.warning;
  return COLORS.success;
}

function getScoreGlow(score: number): string {
  if (score <= 39) return "rgba(239,68,68,0.25)";
  if (score <= 59) return "rgba(249,115,22,0.25)";
  if (score <= 79) return "rgba(245,158,11,0.25)";
  return "rgba(34,197,94,0.25)";
}



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function band(score: number | undefined) {
  if (typeof score !== "number") return undefined;
  if (score >= 85) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 40) return "Average";
  return "Poor";
}

// ---------------------------------------------------------------------------
// Score Badge Component
// ---------------------------------------------------------------------------
type ScoreBadgeProps = {
  score: number | undefined;
  label: string;
};

function ScoreBadge({ score, label }: ScoreBadgeProps) {
  const hasScore = typeof score === "number";
  const color = hasScore ? getScoreColor(score) : COLORS.sub;
  const glow = hasScore ? getScoreGlow(score) : "transparent";
  const displayScore = hasScore ? Math.round(score) : "--";

  return (
    <Animated.View entering={FadeIn.delay(100)} style={styles.scoreBadgeContainer}>
      <View
        style={[
          styles.scoreBadge,
          {
            width: SCORE_BADGE_SIZE,
            height: SCORE_BADGE_SIZE,
            borderRadius: SCORE_BADGE_SIZE / 2,
            borderColor: color,
            shadowColor: color,
          },
        ]}
      >
        <View style={[styles.scoreBadgeGlow, { backgroundColor: glow }]} />
        <Text style={[styles.scoreBadgeValue, { color, fontSize: SCORE_FONT }]}>{displayScore}</Text>
      </View>
      <Text variant="smallSemiBold" style={styles.scoreBadgeLabel}>{label}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Header Component
// ---------------------------------------------------------------------------
type AnalysisHeaderProps = {
  currentMetric: string;
  currentIndex: number;
  total: number;
  score: number | undefined;
};

function AnalysisHeader({ currentMetric, currentIndex, total, score }: AnalysisHeaderProps) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerTitleBlock}>
          <Text variant="h3" color="text" style={{ fontSize: TITLE_FONT }}>{currentMetric}</Text>
          <View style={styles.positionBadge}>
            <Text variant="smallSemiBold" style={[styles.positionText, { fontSize: POSITION_FONT }]}>
              {currentIndex + 1} of {total}
            </Text>
          </View>
        </View>
        <ScoreBadge score={score} label="Score" />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { scores, explanations, explLoading, explError } = useScores();
  const sizing = useMetricSizing();

  const pagerRef = useRef<PagerView>(null);
  const [idx, setIdx] = useState(0);
  const nav = useRouter();

  const hasScores = !!scores;
  const hasAnyExplanation = useMemo(() => {
    if (!explanations) return false;
    return Object.values(explanations).some((lines) =>
      Array.isArray(lines) ? lines.some((line) => typeof line === "string" && line.trim().length > 0) : false
    );
  }, [explanations]);
  const showEmptyState = !hasScores || !hasAnyExplanation;

  const isFirst = idx === 0;
  const isLast = idx === ORDER.length - 1;

  const currentMetric = ORDER[idx];
  const currentScore = scores?.[currentMetric] as number | undefined;
  const scoreGlow = typeof currentScore === "number" ? getScoreGlow(currentScore) : COLORS.accentGlow;

  function goTo(page: number) {
    pagerRef.current?.setPage(page);
  }

  return (
    <View style={styles.screen}>
      {/* Background gradient */}
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
      />

      {/* Dynamic color glow at top based on current score */}
      <LinearGradient
        colors={[scoreGlow, "transparent"]}
        style={[styles.topGlow, { height: GLOW_H }]}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header with metric name and score */}
        <AnalysisHeader
          currentMetric={LABELS[currentMetric]}
          currentIndex={idx}
          total={ORDER.length}
          score={currentScore}
        />

        {/* Loading/Error/Empty states */}
        {explLoading && (
          <View style={styles.stateContainer}>
            <StateView loading loadingText="Analyzing facial features..." />
          </View>
        )}

        {explError && !explLoading && (
          <View style={styles.stateContainer}>
            <StateView error={String(explError)} />
          </View>
        )}

        {showEmptyState && !explLoading && !explError && (
          <View style={styles.emptyBanner}>
            <View style={styles.emptyBannerIcon}>
              <Text style={styles.emptyIcon}>🔬</Text>
            </View>
            <Text variant="captionMedium" color="sub" style={styles.emptyBannerText}>
              Run a face scan to see detailed analysis
            </Text>
          </View>
        )}

        {/* Swipeable cards */}
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={(e) => setIdx(e.nativeEvent.position)}
        >
          {ORDER.map((metric) => {
            const score = scores?.[metric] as number | undefined;
            const current = band(score) ? `Current: ${band(score)}` : undefined;

            const verdicts = getSubmetricVerdicts(explanations, metric);
            const cleanedVerdicts = verdicts.map((line) => {
              const trimmed = line?.trim();
              return trimmed && trimmed.length > 0 ? trimmed : undefined;
            });
            const hasVerdictCopy = cleanedVerdicts.some(Boolean);

            const titles = SUBMETRICS[metric];
            const submetrics: SubmetricView[] = titles.map((t, i) => ({
              title: t,
              verdict: hasVerdictCopy ? cleanedVerdicts[i] : undefined,
            }));

            return (
              <View key={metric} style={styles.page}>
                <MetricCardShell renderSurface={false} sizing={sizing}>
                  {() => (
                    <>
                      <AnalysisCard
                        metric={metric}
                        copy={{ title: LABELS[metric], currentLabel: current }}
                        submetrics={submetrics}
                      />
                      {!hasVerdictCopy && !explLoading && (explanations || explError) && (
                        <View style={styles.noDataCard}>
                          <Text variant="caption" color="sub" style={styles.noDataText}>
                            Detailed insights aren't available for this metric. Try running a new analysis.
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </MetricCardShell>
              </View>
            );
          })}
        </PagerView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + SP[2] }]}>
          <MetricPagerFooter
            index={idx}
            total={ORDER.length}
            onPrev={() => {
              if (!isFirst) goTo(idx - 1);
            }}
            onNext={() => (isLast ? nav.push("/(tabs)/program") : goTo(idx + 1))}
            isFirst={isFirst}
            isLast={isLast}
            nextLabel={isLast ? "Tasks" : "Next"}
            padX={sw(16)}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: HEADER_PAD_H,
    paddingTop: HEADER_PAD_TOP,
    paddingBottom: HEADER_PAD_BOTTOM,
    gap: HEADER_GAP,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitleBlock: {
    flex: 1,
    gap: sh(4),
  },
  positionBadge: {
    backgroundColor: COLORS.whiteGlass,
    paddingHorizontal: POSITION_PAD_H,
    paddingVertical: POSITION_PAD_V,
    borderRadius: RADII.circle,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  positionText: {
    color: COLORS.sub,
  },

  // Score badge
  scoreBadgeContainer: {
    alignItems: "center",
    gap: sh(2),
  },
  scoreBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 2,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowOpacity: 0.4,
          shadowRadius: ms(10),
          shadowOffset: { width: 0, height: sh(3) },
        }
      : { elevation: 8 }),
  },
  scoreBadgeGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  scoreBadgeValue: {
    fontFamily: "Poppins-SemiBold",
  },
  scoreBadgeLabel: {
    color: COLORS.sub,
    fontSize: ms(11, 0.3),
  },

  // State containers
  stateContainer: {
    paddingVertical: sh(16),
    paddingHorizontal: sw(16),
  },

  // Empty banner
  emptyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    marginHorizontal: sw(16),
    paddingHorizontal: sw(16),
    paddingVertical: sh(12),
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyBannerIcon: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: COLORS.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: ms(18),
  },
  emptyBannerText: {
    flex: 1,
  },

  // Pager
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },

  // No data card
  noDataCard: {
    marginTop: sh(8),
    paddingHorizontal: sw(16),
    paddingVertical: sh(12),
    backgroundColor: COLORS.whiteGlass,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  noDataText: {
    textAlign: "center",
  },

  // Footer
  footer: {
    paddingTop: FOOTER_PAD_TOP,
  },
});
