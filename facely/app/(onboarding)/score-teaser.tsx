// app/(onboarding)/score-teaser.tsx
// Redesigned: swipeable category pages with 2D SVG face diagram + blurred sub-metrics
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
  FlatList,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown, Easing } from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { useScores } from "@/store/scores";
import type { Explanations } from "@/lib/api/analysis";
import { hapticSuccess } from "@/lib/haptics";
import { getVerdictStyle } from "@/lib/verdictColor";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Category definitions ───────────────────────────────────────────── */

type CategoryDef = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  subMetrics: readonly [string, string, string, string];
};

const CATEGORIES: CategoryDef[] = [
  {
    key: "eyes_symmetry",
    label: "Eye Symmetry",
    emoji: "👁️",
    color: "#4DD9FF",
    subMetrics: ["Shape", "Symmetry", "Canthal Tilt", "Color"],
  },
  {
    key: "facial_symmetry",
    label: "Proportions",
    emoji: "⚖️",
    color: "#FF6B9D",
    subMetrics: ["Horizontal Alignment", "Vertical Balance", "Eye-Line Level", "Nose-Line Centering"],
  },
  {
    key: "nose_harmony",
    label: "Nose Harmony",
    emoji: "👃",
    color: "#FFB347",
    subMetrics: ["Nose Shape", "Straightness", "Nose Balance", "Nose Tip Type"],
  },
  {
    key: "skin_quality",
    label: "Skin Quality",
    emoji: "💧",
    color: "#B4F34D",
    subMetrics: ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  },
  {
    key: "jawline",
    label: "Jawline",
    emoji: "🔷",
    color: "#A78BFA",
    subMetrics: ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  },
  {
    key: "cheekbones",
    label: "Cheekbones",
    emoji: "✦",
    color: "#34D399",
    subMetrics: ["Definition", "Face Fat", "Maxilla Development", "Bizygomatic Width"],
  },
  {
    key: "sexual_dimorphism",
    label: "Masculinity",
    emoji: "💪",
    color: "#FB923C",
    subMetrics: ["Face Power", "Hormone Balance", "Contour Strength", "Softness Level"],
  },
];

/* ─── Mock verdicts (shown when backend hasn't responded yet) ────────── */
// Mid-tier options so they look realistic, not suspiciously good/bad
const MOCK_VERDICTS: Record<string, readonly [string, string, string, string]> = {
  eyes_symmetry:     ["Neutral Eyes",        "Slight Asymmetry",    "Neutral Tilt",         "Clear Bright"],
  facial_symmetry:   ["Slight Asymmetry",    "Balanced Axis",       "Even Placement",       "Symmetrical Position"],
  nose_harmony:      ["Well-Defined",        "Minimal Deviation",   "Proportional",         "Projected Tip"],
  skin_quality:      ["Good Clarity",        "Moderately Smooth",   "Mostly Even",          "Age-Appropriate"],
  jawline:           ["Moderate Definition", "Slight Asymmetry",    "Defined(109–113°)",    "Well-Proportioned"],
  cheekbones:        ["Moderate Prominence", "Athletic",            "Moderate Development", "Moderate Width"],
  sexual_dimorphism: ["Average Masculinity", "Normal Markers",      "Chiseled",             "Normal Padding"],
};

/* ─── Analysis image map ─────────────────────────────────────────────── */

const IMAGE_MAP: Record<string, ReturnType<typeof require>> = {
  eyes_symmetry:     require("@/assets/analysis-images/eyes_symmetry.jpg"),
  facial_symmetry:   require("@/assets/analysis-images/facial_symmetry.jpg"),
  nose_harmony:      require("@/assets/analysis-images/nose_harmony.jpg"),
  skin_quality:      require("@/assets/analysis-images/skin_quality.jpg"),
  jawline:           require("@/assets/analysis-images/jawline.jpg"),
  cheekbones:        require("@/assets/analysis-images/cheekbones.jpg"),
  sexual_dimorphism: require("@/assets/analysis-images/sexual_dimorphism.jpg"),
};

/* ─── Smoke pill (shared blur primitive) ────────────────────────────── */
// iOS: real content underneath + BlurView on top
// Android: no text rendered at all — smoke smear bars simulate blurred content

function SmokePill({
  color,
  iosContent,
  style,
}: {
  color: string;
  iosContent: React.ReactNode;
  style?: object;
}) {
  if (Platform.OS === "ios") {
    return (
      <View style={[styles.smokePillBase, { borderColor: color + "30" }, style]}>
        {iosContent}
        <BlurView intensity={60} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color + "18" }]} />
      </View>
    );
  }

  // Android — never render sensitive text; show smoke smear bars instead
  return (
    <View style={[styles.smokePillBase, { backgroundColor: "rgba(8,8,8,0.96)", borderColor: color + "35" }, style]}>
      <View style={[styles.smokeBar1, { backgroundColor: color + "CC" }]} />
      <View style={[styles.smokeBar2, { backgroundColor: color + "80" }]} />
    </View>
  );
}

/* ─── Sub-metric row ─────────────────────────────────────────────────── */

function SubMetricRow({
  title,
  verdict,
  verdictColor,
}: {
  title: string;
  verdict: string;
  verdictColor: string;
}) {
  return (
    <View style={styles.subRow}>
      <View style={[styles.subDot, { backgroundColor: verdictColor + "55" }]} />

      <T variant="caption" style={styles.subTitle} numberOfLines={1}>
        {title}
      </T>

      <SmokePill
        color={verdictColor}
        style={styles.verdictPill}
        iosContent={
          <T style={[styles.verdictText, { color: verdictColor }]} numberOfLines={1}>
            {verdict}
          </T>
        }
      />
    </View>
  );
}

/* ─── Score bar ──────────────────────────────────────────────────────── */

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={styles.scoreBarRow}>
      <T variant="captionSemiBold" color="sub" style={styles.scoreLabel}>
        SCORE
      </T>

      {/* Bar track — real fill on iOS under BlurView; smoke smear on Android */}
      {Platform.OS === "ios" ? (
        <View style={styles.scoreBarBlurWrap}>
          <View style={styles.scoreBarTrack}>
            <View style={[styles.scoreBarFill, { width: `${score}%` as any, backgroundColor: color }]} />
          </View>
          <BlurView intensity={55} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color + "15", borderRadius: 3 }]} />
        </View>
      ) : (
        /* Android — never render real fill %; show a static smoke smear */
        <View style={[styles.scoreBarBlurWrap, styles.scoreBarSmokeWrap]}>
          <View style={[styles.scoreSmear, { backgroundColor: color + "BB" }]} />
        </View>
      )}

      {/* Number pill — SmokePill shows real number on iOS, smoke bars on Android */}
      <SmokePill
        color={color}
        style={styles.blurPill}
        iosContent={
          <T style={[styles.blurNumber, { color }]}>{Math.round(score)}</T>
        }
      />
    </View>
  );
}

/* ─── Category page card ─────────────────────────────────────────────── */

type CategoryItem = CategoryDef & { score: number };

function CategoryCard({
  item,
  explanations,
}: {
  item: CategoryItem;
  explanations: Explanations | null;
}) {
  const backendVerdicts = explanations?.[item.key];
  const mockVerdicts = MOCK_VERDICTS[item.key];

  const rows = item.subMetrics.map((title, i) => {
    // Use real backend verdict if available and non-empty, otherwise mock
    const verdict =
      backendVerdicts?.[i]?.trim() ? backendVerdicts[i] : mockVerdicts[i];
    const verdictColor = getVerdictStyle(item.key, i, verdict).color;
    return { title, verdict, verdictColor };
  });

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.card}
        contentContainerStyle={styles.cardContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <T style={styles.categoryEmoji}>{item.emoji}</T>
          <View style={{ flex: 1 }}>
            <T variant="h3" color="text">{item.label}</T>
            <T variant="caption" color="sub" style={{ opacity: 0.6 }}>
              Subscribe to reveal
            </T>
          </View>
        </View>

        {/* Analysis image */}
        <View style={styles.diagramWrap}>
          <Image
            source={IMAGE_MAP[item.key]}
            style={styles.analysisImage}
            resizeMode="contain"
          />
          {/* Per-category color tint */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: item.color + "18" }]} />
        </View>

        {/* Score bar */}
        <ScoreBar score={item.score} color={item.color} />

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Sub-metrics label */}
        <T variant="captionSemiBold" color="sub" style={styles.subMetricsLabel}>
          SUB-METRICS
        </T>

        {/* Sub-metric rows: real title + blurred verdict in tier color */}
        {rows.map((r) => (
          <SubMetricRow
            key={r.title}
            title={r.title}
            verdict={r.verdict}
            verdictColor={r.verdictColor}
          />
        ))}

        <View style={styles.cardBottomPad} />
      </ScrollView>
    </View>
  );
}

/* ─── Pagination dots ────────────────────────────────────────────────── */

function PaginationDots({ total, activeIndex }: { total: number; activeIndex: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
      ))}
    </View>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const DEFAULT_SCORE = 72;

function getScore(scores: any, key: string): number {
  const raw = Number(scores?.scores?.[key] ?? scores?.[key]);
  return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : DEFAULT_SCORE;
}

/* ─── Main screen ────────────────────────────────────────────────────── */

export default function ScoreTeaserScreen() {
  const insets = useSafeAreaInsets();
  const { scores, explanations } = useScores();
  const [activeIndex, setActiveIndex] = useState(0);

  const categoryItems = useMemo<CategoryItem[]>(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        score: getScore(scores, c.key),
      })),
    [scores]
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; isViewable: boolean }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleUnlock = useCallback(() => {
    hapticSuccess();
    router.push("/(onboarding)/goals");
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CategoryItem }) => (
      <CategoryCard item={item} explanations={explanations} />
    ),
    [explanations]
  );

  const keyExtractor = useCallback((item: CategoryItem) => item.key, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Progress bar */}
      <View style={[styles.progressTrack, { marginTop: insets.top + SP[3] }]}>
        <View style={[styles.progressFill, { width: "100%" }]} />
      </View>

      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400).easing(Easing.out(Easing.cubic))}
        style={styles.header}
      >
        <T variant="h2" color="text">
          Your Score{"\n"}Is Ready
        </T>
        <T variant="body" color="sub" style={styles.subline}>
          Subscribe to unlock your complete facial breakdown
        </T>
      </Animated.View>

      {/* Swipeable category cards */}
      <FlatList
        data={categoryItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Pagination dots */}
      <PaginationDots total={CATEGORIES.length} activeIndex={activeIndex} />

      {/* Lock hint */}
      <Animated.View
        entering={FadeInDown.delay(250).duration(400).easing(Easing.out(Easing.cubic))}
        style={styles.lockHint}
      >
        <T variant="caption" color="sub" align="center">
          🔒  Swipe to preview all {CATEGORIES.length} categories
        </T>
      </Animated.View>

      {/* Sticky CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + SP[4] }]}>
        <View style={styles.ctaShadow}>
          <Pressable
            onPress={handleUnlock}
            style={({ pressed }) => [
              styles.ctaInner,
              { transform: [{ translateY: pressed ? 5 : 0 }] },
            ]}
          >
            <LinearGradient
              colors={["#CCFF6B", "#B4F34D"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.ctaGradient}
            >
              <T style={styles.ctaText}>Fix My Face Now</T>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },

  progressTrack: {
    height: 8,
    marginHorizontal: SP[6],
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginBottom: SP[4],
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },

  header: {
    paddingHorizontal: SP[6],
    marginBottom: SP[3],
  },
  subline: {
    marginTop: SP[2],
  },

  flatList: {
    flex: 1,
  },

  /* Page / Card */
  page: {
    width: SCREEN_W,
    paddingHorizontal: SP[5],
  },
  card: {
    borderRadius: RADII.card,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
    }),
  },
  cardContent: {
    paddingBottom: SP[3],
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[3],
  },
  categoryEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },

  diagramWrap: {
    overflow: "hidden",
    backgroundColor: "#0A0A0A",
  },
  analysisImage: {
    width: "100%",
    height: 220,
  },

  /* Score bar */
  scoreBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[5],
    paddingVertical: SP[3],
  },
  scoreLabel: {
    letterSpacing: 0.8,
    opacity: 0.45,
    width: 44,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },
  scoreBarBlurWrap: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  blurPill: {
    width: 44,
    height: 30,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  blurNumber: {
    fontSize: 13,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  cardDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SP[5],
  },

  subMetricsLabel: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    paddingBottom: SP[1],
    letterSpacing: 0.8,
    opacity: 0.4,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },

  subRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingVertical: SP[2] + 1,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: SP[2],
  },
  subDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    flexShrink: 0,
  },
  subTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.65)",
  },
  verdictPill: {
    height: 28,
    minWidth: 90,
    maxWidth: 160,
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[2] + 2,
  },
  verdictText: {
    fontSize: 12,
    lineHeight: 28,
    fontFamily: "Poppins-SemiBold",
  },

  /* SmokePill base — shared by both verdict pill and score number pill */
  smokePillBase: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  /* Smoke smear bars rendered inside SmokePill on Android (no real text) */
  smokeBar1: {
    width: "72%",
    height: 4,
    borderRadius: 3,
    marginBottom: 3,
  },
  smokeBar2: {
    width: "50%",
    height: 3,
    borderRadius: 2,
  },

  /* Score bar — Android smoke wrapper + single smear */
  scoreBarSmokeWrap: {
    backgroundColor: "rgba(8,8,8,0.95)",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  scoreSmear: {
    width: "58%",
    height: 5,
    borderRadius: 2.5,
  },

  cardBottomPad: {
    height: SP[2],
  },

  /* Pagination dots */
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SP[3],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },

  lockHint: {
    paddingHorizontal: SP[6],
    paddingBottom: SP[2],
  },

  /* CTA */
  ctaContainer: {
    paddingHorizontal: SP[6],
    paddingTop: SP[2],
  },
  ctaShadow: {
    borderRadius: 28,
    backgroundColor: "#6B9A1E",
    paddingBottom: 6,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  ctaInner: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  ctaGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  ctaText: {
    color: COLORS.bgTop,
    fontSize: 17,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
});
