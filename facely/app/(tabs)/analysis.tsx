// app/(tabs)/analysis.tsx
// Advanced Analysis — 4 swipeable category cards with AI commentary per sub-metric.

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { View, ScrollView, StyleSheet, Pressable, Image } from "react-native";
import PagerView from "react-native-pager-view";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Gem, Triangle, Eye, Sparkles } from "lucide-react-native";

import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sw, sh } from "@/lib/responsive";
import { useScores } from "@/store/scores";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { router } from "expo-router";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";

// ---------------------------------------------------------------------------
// Card group definitions
// ---------------------------------------------------------------------------

type ScoreKey = "cheekbones" | "jawline" | "eyes_symmetry" | "skin_quality";

type SubmetricDef = { key: string; label: string; emoji: string };

type CardGroup = {
  key: keyof AdvancedAnalysis;
  label: string;
  subtitle: string;
  scoreKey: ScoreKey;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  image: ReturnType<typeof require>;
  submetrics: readonly SubmetricDef[];
};

const CARD_GROUPS: CardGroup[] = [
  {
    key: "cheekbones",
    label: "CHEEKBONES",
    subtitle: "Midface structure",
    scoreKey: "cheekbones",
    Icon: Gem,
    image: require("@/assets/analysis-image-new/cheekbones analysis.jpeg"),
    submetrics: [
      { key: "width",          label: "Cheekbones Width",    emoji: "↔️" },
      { key: "maxilla",        label: "Maxilla Development", emoji: "💀" },
      { key: "bone_structure", label: "Bone Structure",      emoji: "🦴" },
      { key: "face_fat",       label: "Face Fat",            emoji: "⭕" },
    ],
  },
  {
    key: "jawline",
    label: "JAWLINE",
    subtitle: "Lower face definition",
    scoreKey: "jawline",
    Icon: Triangle,
    image: require("@/assets/analysis-image-new/jawline analysis.jpeg"),
    submetrics: [
      { key: "development",  label: "Development",  emoji: "💪" },
      { key: "gonial_angle", label: "Gonial Angle", emoji: "📐" },
      { key: "projection",   label: "Chin Projection", emoji: "🔺" },
    ],
  },
  {
    key: "eyes",
    label: "EYES",
    subtitle: "Orbital & lid structure",
    scoreKey: "eyes_symmetry",
    Icon: Eye,
    image: require("@/assets/analysis-image-new/eye area naalysis.jpeg"),
    submetrics: [
      { key: "canthal_tilt", label: "Canthal Tilt", emoji: "📐" },
      { key: "eye_type",     label: "Eye Type",     emoji: "👁️" },
      { key: "brow_volume",  label: "Brow Volume",  emoji: "🤨" },
      { key: "symmetry",     label: "Symmetry",     emoji: "⚖️" },
    ],
  },
  {
    key: "skin",
    label: "SKIN",
    subtitle: "Surface quality",
    scoreKey: "skin_quality",
    Icon: Sparkles,
    image: require("@/assets/analysis-image-new/skin analysis.jpeg"),
    submetrics: [
      { key: "color",   label: "Color",   emoji: "🎨" },
      { key: "quality", label: "Quality", emoji: "✨" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Score → visual helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number | undefined): string {
  if (score === undefined) return COLORS.sub;
  if (score >= 65) return COLORS.success;
  if (score >= 40) return COLORS.warning;
  return COLORS.error;
}

function getRating(score: number | undefined): string {
  if (score === undefined) return "";
  if (score >= 90) return "Exceptional";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Above Average";
  if (score >= 40) return "Average";
  return "Needs Work";
}


// ---------------------------------------------------------------------------
// Shimmer line — pulsing placeholder while commentary loads
// ---------------------------------------------------------------------------

function ShimmerLine({ width = "100%", delay = 0 }: { width?: string | number; delay?: number }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 750, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 750, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.shimmerLine, { width: width as any }, animStyle]} />
  );
}

// ---------------------------------------------------------------------------
// Sub-metric row
// ---------------------------------------------------------------------------

type TagDef = { label: string; color: string; light: string; dark: string };

function getTag(score: number): TagDef {
  if (score >= 91) return { label: "EXCEPTIONAL", color: "#10B981", light: "#34D399", dark: "#065F46" };
  if (score >= 76) return { label: "STRONG",      color: "#B4F34D", light: "#CCFF6B", dark: "#4A6A10" };
  if (score >= 61) return { label: "ACCEPTABLE",  color: "#7DD3FC", light: "#BAE6FD", dark: "#0C4A6E" };
  if (score >= 46) return { label: "AVERAGE",     color: "#F59E0B", light: "#FCD34D", dark: "#78350F" };
  if (score >= 31) return { label: "BELOW AVG",   color: "#F97316", light: "#FB923C", dark: "#7C2D12" };
  if (score >= 16) return { label: "WEAK",        color: "#EF4444", light: "#F87171", dark: "#7F1D1D" };
  return               { label: "POOR",        color: "#DC2626", light: "#EF4444", dark: "#7F1D1D" };
}

function SubmetricRow({
  label,
  emoji,
  commentary,
  score,
  isLast,
  index,
}: {
  label: string;
  emoji: string;
  commentary: string | undefined;
  score: number | undefined;
  isLast: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [typedText, setTypedText] = useState("");
  const hasAnimated = useRef(false);
  const tag = score !== undefined ? getTag(score) : null;
  const hasData = commentary && commentary.length > 0;

  // Chevron rotation: 0 = down, 1 = up (180°)
  const chevronRot = useSharedValue(0);
  // Commentary reveal: maxHeight + opacity
  const revealProgress = useSharedValue(0);

  // Typewriter effect — only runs the very first time this row is opened
  useEffect(() => {
    if (!expanded || !commentary) return;

    // Already animated once — show full text instantly
    if (hasAnimated.current) {
      setTypedText(commentary);
      return;
    }

    setTypedText("");
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTypedText(commentary.slice(0, i));
      if (i >= commentary.length) {
        clearInterval(timer);
        hasAnimated.current = true;
      }
    }, 32);
    return () => clearInterval(timer);
  }, [expanded, commentary]);

  const toggle = () => {
    if (!hasData) return;
    const next = !expanded;
    setExpanded(next);
    chevronRot.value = withSpring(next ? 1 : 0, { damping: 14, stiffness: 180 });
    revealProgress.value = withSpring(next ? 1 : 0, { damping: 18, stiffness: 160 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronRot.value, [0, 1], [0, 180])}deg` }],
  }));

  const commentaryStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(revealProgress.value, [0, 1], [0, 200]),
    opacity: interpolate(revealProgress.value, [0, 0.4], [0, 1]),
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(340).delay(80 + index * 55)}
      style={[styles.subRow, !isLast && styles.subRowBorder]}
    >
      {/* Header row */}
      <View style={styles.subLabelRow}>
        {/* Left group: bullet + emoji + pill + chevron */}
        <View style={styles.subLabelLeft}>
          <View style={styles.subBullet} />
          <Text style={styles.subEmoji}>{emoji}</Text>
          <View style={styles.subLabelPill}>
            <Text style={styles.subLabel} numberOfLines={1}>{label}</Text>
          </View>
          {hasData && (
            <Pressable onPress={toggle} hitSlop={10}>
              <Animated.View style={chevronStyle}>
                <ChevronDown size={ms(13)} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
              </Animated.View>
            </Pressable>
          )}
        </View>

        {/* Tag chip — colored 3D button */}
        {tag && hasData ? (
          <Animated.View
            entering={ZoomIn.springify().damping(14).stiffness(160).delay(120 + index * 70)}
            style={[styles.tagDepth, { backgroundColor: tag.dark, shadowColor: tag.color }]}
          >
            <Pressable
              onPress={toggle}
              style={({ pressed }) => ({
                borderRadius: 20,
                overflow: "hidden",
                transform: [{ translateY: pressed ? 4 : 0 }],
              })}
            >
              <LinearGradient
                colors={[tag.light, tag.color]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.tagFace}
              >
                <Text style={styles.tagText}>{tag.label}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : !hasData ? (
          <View style={styles.tagChipShimmer}>
            <ShimmerLine width={sw(52)} delay={index * 110} />
          </View>
        ) : null}
      </View>

      {/* Commentary — animated slide-down + typewriter */}
      {hasData && (
        <Animated.View style={[styles.subCommentaryWrap, commentaryStyle]}>
          <Text style={styles.subCommentary}>
            {typedText}
            {expanded && typedText.length < (commentary?.length ?? 0) && (
              <Text style={styles.subCursor}>|</Text>
            )}
          </Text>
        </Animated.View>
      )}

      {/* Shimmer rows while loading */}
      {!hasData && (
        <View style={[styles.shimmerWrap, { marginTop: sh(6) }]}>
          <ShimmerLine width="88%" delay={index * 110} />
          <ShimmerLine width="60%" delay={index * 110 + 140} />
        </View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Category card (one full page)
// ---------------------------------------------------------------------------

function CategoryCard({
  group,
  score,
  groupData,
  error,
  onRetry,
}: {
  group: CardGroup;
  score: number | undefined;
  groupData: Record<string, any> | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  const { Icon } = group;
  const scoreColor = getScoreColor(score);
  // Use tag color for rating text — guarantees it matches the chips exactly
  const ratingColor = score !== undefined ? getTag(score).color : scoreColor;

  // Micro-interaction 1: count-up score number
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    if (score === undefined) return;
    const target = Math.round(score);
    const steps = 36;
    const stepVal = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + stepVal, target);
      setDisplayScore(Math.round(current));
      if (current >= target) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [score]);

  // Micro-interaction 2: progress bar fill
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(score ?? 0, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as any,
  }));

  return (
    <ScrollView
      style={styles.cardScroll}
      contentContainerStyle={styles.cardScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(280)} style={styles.cardShadow}>
      <View style={styles.card}>

        {/* ── Card header: icon + title ── */}
        <View style={styles.cardTop}>
          <View
            style={[
              styles.iconWrap,
              { borderColor: COLORS.accent + "55", backgroundColor: COLORS.accent + "18" },
            ]}
          >
            <Icon size={ms(14)} color={COLORS.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardCategoryLabel}>{group.label}</Text>
            <Text style={styles.cardSubtitle}>{group.subtitle}</Text>
          </View>
        </View>

        {/* ── Split row: image left · score panel right ── */}
        <View style={styles.cardSplit}>

          {/* Image square */}
          <View style={styles.splitImageWrap}>
            <Image source={group.image} style={styles.splitImage} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(180,243,77,0.22)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 0.5 }}
            />
          </View>

          {/* Score panel */}
          <View style={styles.splitScorePanel}>
            {/* Big number — count-up */}
            <View style={styles.splitScoreRow}>
              <Text style={[styles.splitScoreValue, { color: ratingColor }]}>
                {score !== undefined ? displayScore : "—"}
              </Text>
              <Text style={styles.splitScoreDenom}>/100</Text>
            </View>

            {/* Progress bar — fill animation */}
            <View style={styles.splitBarTrack}>
              <Animated.View
                style={[
                  styles.splitBarFill,
                  { backgroundColor: ratingColor },
                  barStyle,
                ]}
              />
            </View>

            {/* Rating label — delayed fade-slide */}
            <Animated.View entering={FadeInDown.duration(400).delay(700)}>
              <Text style={[styles.splitRating, { color: ratingColor }]}>
                {getRating(score)}
              </Text>
            </Animated.View>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.cardDivider} />

        {/* ── Error state — single card-level message ── */}
        {error && !groupData ? (
          <View style={styles.cardError}>
            <Text style={styles.cardErrorText}>Analysis unavailable</Text>
            <Text style={styles.cardErrorSub}>Could not load commentary for this category.</Text>
            <Pressable onPress={onRetry} style={({ pressed }) => [styles.cardRetryBtn, pressed && { opacity: 0.75 }]}>
              <Text style={styles.cardRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Sub-metric rows (shimmer until commentary arrives) ── */
          group.submetrics.map((sm, i) => (
            <SubmetricRow
              key={sm.key}
              label={sm.label}
              emoji={sm.emoji}
              commentary={groupData?.[sm.key] as string | undefined}
              score={groupData?.[sm.key + "_score"] as number | undefined}
              isLast={i === group.submetrics.length - 1}
              index={i}
            />
          ))
        )}
      </View>
      </Animated.View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Page dots — active dot is wider pill
// ---------------------------------------------------------------------------

function PageDots({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === active ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — no scan yet
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>🔬</Text>
      <Text style={styles.emptyTitle}>No scan data</Text>
      <Text style={styles.emptySub}>
        Run a face scan to unlock your full advanced analysis.
      </Text>
      <View style={styles.emptyBtnDepth}>
        <Pressable
          onPress={() => router.push("/(tabs)/take-picture")}
          style={({ pressed }) => [
            styles.emptyBtn,
            { transform: [{ translateY: pressed ? 5 : 0 }] },
          ]}
        >
          <LinearGradient
            colors={["#CCFF6B", COLORS.accent]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.emptyBtnText}>Scan Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const [idx, setIdx] = useState(0);

  const { scores, imageUri } = useScores();
  const { data, loading, error, fetch } = useAdvancedAnalysis();

  const hasScores = !!scores && !!imageUri;
  const isFirst = idx === 0;
  const isLast = idx === CARD_GROUPS.length - 1;

  const currentGroup = CARD_GROUPS[idx];
  const topGlowColor = COLORS.accentGlow;

  // Micro-interaction 4: badge bounce on page change
  const badgeScale = useSharedValue(1);
  useEffect(() => {
    badgeScale.value = withSequence(
      withSpring(1.2, { damping: 5, stiffness: 300 }),
      withSpring(1,   { damping: 8, stiffness: 200 })
    );
  }, [idx]);
  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  // Fetch on every tab focus — catches: first mount, back-navigation, new scan
  useFocusEffect(
    useCallback(() => {
      if (hasScores && !data && !loading) {
        fetch();
      }
    }, [hasScores, data, loading])
  );

  const goTo = useCallback((page: number) => {
    pagerRef.current?.setPage(page);
  }, []);

  return (
    <View style={styles.screen}>
      {/* Background gradient */}
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
      />

      {/* Dynamic top glow — color follows current card's score */}
      <LinearGradient
        colors={[topGlowColor, "transparent"]}
        style={styles.topGlow}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(380)} style={styles.header}>
          <Text style={styles.headerTitle}>Advanced Analysis</Text>
          {hasScores && (
            <Animated.View style={[styles.positionBadge, badgeAnimStyle]}>
              <Text style={styles.positionText}>{idx + 1} of {CARD_GROUPS.length}</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Page dots ── */}
        {hasScores && <PageDots total={CARD_GROUPS.length} active={idx} />}

        {/* ── Content ── */}
        {!hasScores ? (
          <EmptyState />
        ) : (
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={0}
            onPageSelected={(e) => setIdx(e.nativeEvent.position)}
          >
            {CARD_GROUPS.map((group) => {
              const score = scores?.[group.scoreKey] as number | undefined;
              const groupData = data
                ? (data[group.key] as Record<string, any>)
                : undefined;

              return (
                <View key={group.key} style={styles.page}>
                  <CategoryCard
                    group={group}
                    score={score}
                    groupData={groupData}
                    error={error}
                    onRetry={fetch}
                  />
                </View>
              );
            })}
          </PagerView>
        )}

        {/* ── Footer nav ── */}
        {hasScores && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + SP[2] }]}>

            {/* Prev — ghost 3D button */}
            <View style={[styles.navDepthGhost, isFirst && styles.navBtnDisabled]}>
              <Pressable
                onPress={() => !isFirst && goTo(idx - 1)}
                disabled={isFirst}
                style={({ pressed }) => [
                  styles.navBtn,
                  styles.navBtnGhostFace,
                  { transform: [{ translateY: pressed && !isFirst ? 4 : 0 }] },
                ]}
              >
                <ChevronLeft
                  size={ms(17)}
                  color={isFirst ? COLORS.sub : COLORS.text}
                  strokeWidth={2}
                />
                <Text style={[styles.navBtnText, isFirst && { color: COLORS.sub }]}>
                  Prev
                </Text>
              </Pressable>
            </View>

            {/* Next / Go to Program — lime 3D button */}
            <View style={styles.navDepthSolid}>
              <Pressable
                onPress={() =>
                  isLast ? router.push("/(tabs)/program") : goTo(idx + 1)
                }
                style={({ pressed }) => [
                  styles.navBtn,
                  styles.navBtnSolidFace,
                  { transform: [{ translateY: pressed ? 5 : 0 }] },
                ]}
              >
                <LinearGradient
                  colors={["#CCFF6B", COLORS.accent]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.navBtnSolidText}>
                  {isLast ? "Go to Program" : "Next"}
                </Text>
                <ChevronRight size={ms(17)} color="#0B0B0B" strokeWidth={2.5} />
              </Pressable>
            </View>

          </View>
        )}
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
    height: sh(280),
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sw(20),
    paddingTop: sh(8),
    paddingBottom: sh(4),
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: ms(20, 0.3),
    fontFamily: "Poppins-SemiBold",
  },
  positionBadge: {
    backgroundColor: COLORS.whiteGlass,
    paddingHorizontal: sw(10),
    paddingVertical: sh(3),
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  positionText: {
    color: COLORS.sub,
    fontSize: ms(11, 0.3),
    fontFamily: "Poppins-SemiBold",
  },

  // Page dots
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingTop: sh(6),
    paddingBottom: sh(10),
  },
  dot: {
    height: sh(4),
    borderRadius: 2,
  },
  dotActive: {
    width: sw(22),
    backgroundColor: COLORS.accent,
  },
  dotInactive: {
    width: sw(6),
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  // Pager
  pager: { flex: 1 },
  page: { flex: 1 },

  // Card scroll wrapper
  cardScroll: { flex: 1 },
  cardScrollContent: {
    paddingHorizontal: sw(20),
    paddingTop: sh(2),
    paddingBottom: sh(16),
  },

  // Card shadow wrapper (no overflow — shadows can't render inside overflow:hidden)
  cardShadow: {
    borderRadius: RADII.card,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },

  // Card surface (overflow:hidden clips image/content)
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },

  // Card header (icon + title row)
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[3],
    gap: sw(10),
  },
  iconWrap: {
    width: ms(36),
    height: ms(36),
    borderRadius: RADII.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleBlock: {
    gap: sh(1),
  },
  cardCategoryLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: ms(10, 0.3),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1.6,
  },
  cardSubtitle: {
    color: COLORS.text,
    fontSize: ms(15, 0.3),
    fontFamily: "Poppins-SemiBold",
  },

  // Split row
  cardSplit: {
    flexDirection: "row",
    paddingHorizontal: SP[4],
    paddingBottom: SP[4],
    gap: sw(12),
    alignItems: "center",
  },
  splitImageWrap: {
    width: sw(120),
    height: sw(120),
    borderRadius: RADII.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitImage: {
    width: "100%",
    height: "100%",
  },
  splitScorePanel: {
    flex: 1,
    gap: sh(6),
    justifyContent: "center",
  },
  splitScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: sw(2),
  },
  splitScoreValue: {
    fontSize: ms(44, 0.4),
    fontFamily: "Poppins-SemiBold",
    lineHeight: ms(50, 0.4),
  },
  splitScoreDenom: {
    fontSize: ms(14, 0.3),
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    marginBottom: sh(6),
  },
  splitBarTrack: {
    height: sh(5),
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 3,
    overflow: "hidden",
  },
  splitBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  splitRating: {
    fontSize: ms(11, 0.3),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.6,
  },

  // Hairline under split row
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: SP[4],
  },

  // Sub-metric rows
  subRow: {
    paddingHorizontal: SP[4],
    paddingVertical: sh(16),
  },
  subRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardHairline,
  },
  subLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: sh(6),
  },
  subLabelLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    flexShrink: 1,
    flex: 1,
    marginRight: sw(8),
  },
  subBullet: {
    width: sw(6),
    height: sw(6),
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  subEmoji: {
    fontSize: ms(14),
    lineHeight: ms(18),
  },
  subLabelPill: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: sw(9),
    paddingVertical: sh(3),
  },
  subLabel: {
    color: "#B4F34D",
    fontSize: ms(11, 0.3),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  subCommentary: {
    color: COLORS.text,
    fontSize: ms(13, 0.3),
    fontFamily: "Poppins-SemiBold",
    lineHeight: ms(20, 0.3),
  },
  subCursor: {
    color: COLORS.accent,
    fontSize: ms(13, 0.3),
    fontFamily: "Poppins-SemiBold",
    opacity: 0.85,
  },
  // Card-level error state (replaces per-row empty text)
  cardError: {
    alignItems: "center",
    paddingVertical: sh(36),
    paddingHorizontal: SP[5],
    gap: SP[2],
  },
  cardErrorText: {
    color: COLORS.text,
    fontSize: ms(15, 0.3),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  cardErrorSub: {
    color: COLORS.sub,
    fontSize: ms(13, 0.3),
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    lineHeight: ms(19, 0.3),
  },
  cardRetryBtn: {
    marginTop: SP[2],
    paddingHorizontal: SP[5],
    paddingVertical: sh(8),
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.accent + "70",
    backgroundColor: COLORS.accent + "12",
  },
  cardRetryText: {
    color: COLORS.accent,
    fontSize: ms(13, 0.3),
    fontFamily: "Poppins-SemiBold",
  },

  // Tag chip — 3D dark button
  subRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
  },
  tagDepth: {
    borderRadius: 20,
    // backgroundColor set inline to tag.dark (per-tag colored underside)
    paddingBottom: 4,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  tagFace: {
    // overflow:hidden is on inner Pressable — just padding here
    paddingHorizontal: sw(10),
    paddingVertical: sh(5),
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    fontSize: ms(9, 0.3),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    color: "#fff",
  },
  tagChipShimmer: {
    height: sh(20),
    justifyContent: "center",
  },

  // Commentary expand area
  subCommentaryWrap: {
    paddingTop: sh(6),
    paddingLeft: sw(14),
  },

  // Shimmer
  shimmerWrap: {
    gap: sh(7),
  },
  shimmerLine: {
    height: sh(11),
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: RADII.xs,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(40),
    gap: SP[3],
  },
  emptyIcon: {
    fontSize: ms(44),
    lineHeight: ms(52),
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: ms(20, 0.3),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  emptySub: {
    color: COLORS.sub,
    fontSize: ms(14, 0.3),
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    lineHeight: ms(21, 0.3),
  },
  // 3D depth wrapper for Scan Now
  emptyBtnDepth: {
    marginTop: SP[2],
    width: sw(200),
    borderRadius: RADII.pill,
    backgroundColor: "#4A6A10",
    paddingBottom: 5,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  emptyBtn: {
    height: sh(52),
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emptyBtnText: {
    color: "#0B0B0B",
    fontSize: ms(15, 0.3),
    fontFamily: "Poppins-SemiBold",
  },

  // Footer nav
  footer: {
    flexDirection: "row",
    gap: sw(12),
    paddingHorizontal: sw(20),
    paddingTop: sh(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  navBtn: {
    height: sh(52),
    borderRadius: RADII.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(4),
    overflow: "hidden",
  },
  // Ghost (Prev) depth wrapper
  navDepthGhost: {
    flex: 1,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingBottom: 4,
  },
  // Ghost face (inside the Pressable)
  navBtnGhostFace: {
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  navBtnDisabled: {
    opacity: 0.28,
  },
  navBtnText: {
    color: COLORS.text,
    fontSize: ms(14, 0.3),
    fontFamily: "Poppins-SemiBold",
  },
  // Solid (Next) depth wrapper
  navDepthSolid: {
    flex: 2,
    borderRadius: RADII.pill,
    backgroundColor: "#4A6A10",
    paddingBottom: 5,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  // Solid face fills the pressable (LinearGradient handles bg)
  navBtnSolidFace: {
    // background handled by LinearGradient absoluteFill
  },
  navBtnSolidText: {
    color: "#0B0B0B",
    fontSize: ms(14, 0.3),
    fontFamily: "Poppins-SemiBold",
  },
});
