// components/program/WorkoutPreview.tsx
// Preview screen shown on tab focus before the exercise list.
// Composition mirrors the marathon-app reference: left-weighted headline balanced
// by a right-side inline Start pill; hero face-image bleeds into a bottom
// "Active Stats" card (Focus + Impact tiles).

import React from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Play,
  Flame,
  Target,
  Zap,
  TrendingUp,
  User as UserIcon,
  ChevronRight,
} from "lucide-react-native";
import SpeechBubble from "./SpeechBubble";

import { COLORS, RADII, SP, TYPE, SHADOWS } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import {
  CARD_FACE_IMAGES,
  CARD_FACE_LABELS,
  resolveCardTarget,
  aggregateIntensity,
  intensityBoostPct,
} from "@/lib/faceTargets";
import type { DailyTask } from "@/store/tasks";
import { useTasksStore } from "@/store/tasks";
import { useProfile } from "@/store/profile";
import { useExerciseSettings } from "@/store/exerciseSettings";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.44);

// (3D depth + lime accent constants removed — buttons are now flat black pills)

// Impact bubble copy per focus zone — action-oriented outcome for today's session.
const IMPACT_BUBBLE_TEXT: Record<string, string> = {
  jawline:    "strengthens\nlower face",
  cheekbones: "sculpts your\nmidface",
  eyes:       "lifts the\neye area",
  skin:       "boosts\nskin tone",
  nose:       "refines\nnose contour",
  all:        "full face\nactivation",
};

// Subtitle copy — personalised to target + intensity + completion state.
function buildSubtitle(
  target: string,
  intensity: "high" | "medium" | "low",
  totalMins: number,
  completed: boolean,
  boostPct: number,
): string {
  const region = (CARD_FACE_LABELS[target] ?? "full face").toLowerCase();

  if (completed) {
    return `${CARD_FACE_LABELS[target] ?? "Full face"} — done for today. You're ${boostPct}% closer to your goal.`;
  }

  const verb = intensity === "high" ? "Intense" : intensity === "low" ? "Gentle" : "Sculpting";
  return `${verb} ${region} session. ${totalMins} focused minutes to move the needle.`;
}

export default function WorkoutPreview({
  tasks,
  onStart,
}: {
  tasks: DailyTask[];
  onStart: () => void;
}) {
  const { today, currentStreak } = useTasksStore();
  const { avatarUri, displayName } = useProfile();
  const { getDuration } = useExerciseSettings();

  const firstName = displayName?.split(" ")[0] ?? "there";

  const cardTarget  = resolveCardTarget(tasks);
  const faceImage   = CARD_FACE_IMAGES[cardTarget] ?? CARD_FACE_IMAGES.cheekbones;
  const focusLabel  = CARD_FACE_LABELS[cardTarget] ?? "Full Face";
  const intensity   = aggregateIntensity(tasks);
  const boostPct    = intensityBoostPct(intensity);

  const totalSecs   = tasks.reduce((sum, t) => sum + getDuration(t.exerciseId), 0);
  const totalMins   = Math.max(1, Math.round(totalSecs / 60));

  const isDone      = !!today?.completedOnce || !!today?.allComplete;
  const subtitle    = buildSubtitle(cardTarget, intensity, totalMins, isDone, boostPct);

  const impactText  = IMPACT_BUBBLE_TEXT[cardTarget] ?? IMPACT_BUBBLE_TEXT.all;
  const timeText    = `${totalMins} min\nsession`;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const goToProfile = () => {
    Haptics.selectionAsync();
    router.push("/(tabs)/profile");
  };

  const goToProgress = () => {
    Haptics.selectionAsync();
    router.push("/(tabs)/dashboard");
  };

  return (
    <SafeAreaView style={styles.safe}>
     <ScrollView
       showsVerticalScrollIndicator={false}
       contentContainerStyle={styles.scrollContent}
     >
      {/* ── Top rail ─────────────────────────────────────────────── */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.topRail}>
        <Pressable
          style={styles.railLeft}
          onPress={goToProfile}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <UserIcon size={ms(18)} color={COLORS.lightText} strokeWidth={2} />
              </View>
            )}
          </View>
          <View style={styles.streakStack}>
            <Flame size={ms(13)} color={COLORS.lightText} strokeWidth={2.4} />
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakUnit}>day streak</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.railIconBtn}
          onPress={goToProgress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open progress"
        >
          <TrendingUp size={ms(18)} color={COLORS.lightText} strokeWidth={2.2} />
        </Pressable>
      </Animated.View>

      {/* ── Headline + inline Start pill ─────────────────────────── */}
      <View style={styles.headBlock}>
        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.headText}>
          <Text style={styles.headline} numberOfLines={1}>
            Hey, {firstName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={3}>
            {subtitle}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(160).duration(420)}
          style={styles.startSlot}
        >
          <View style={styles.startDepthWrap}>
            <Pressable
              onPress={handleStart}
              android_ripple={null}
              style={({ pressed }) => [styles.startPillFace, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.startPillGradient}>
                {isDone ? (
                  <>
                    <Text style={styles.startPillText}>REVIEW</Text>
                    <ChevronRight size={ms(15)} color="#FFFFFF" strokeWidth={2.5} />
                  </>
                ) : (
                  <>
                    <Play size={ms(13)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.startPillText}>START</Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      {/* ── Hero face ────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeIn.delay(200).duration(500)}
        style={styles.heroWrap}
      >
        <ExpoImage
          source={faceImage}
          style={styles.heroImage}
          contentFit="contain"
          contentPosition="center"
          transition={400}
        />

        {/* Left bubble — impact of today's session */}
        <SpeechBubble
          text={impactText}
          top="18%"
          left={sw(14)}
          delay={260}
          floatPhase={0}
        />

        {/* Right bubble — session duration */}
        <SpeechBubble
          text={timeText}
          top="52%"
          right={sw(14)}
          delay={480}
          floatPhase={900}
        />
      </Animated.View>

      {/* ── Stats card (overlaps hero) ───────────────────────────── */}
      <Animated.View
        entering={FadeInUp.delay(320).duration(460)}
        style={styles.statsCard}
      >
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Active Stats</Text>
          <View style={styles.miniCtaDepthWrap}>
            <Pressable
              onPress={handleStart}
              android_ripple={null}
              hitSlop={6}
              style={({ pressed }) => [styles.miniCtaFace, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.miniCtaGradient}>
                <Play size={ms(13)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.tileRow}>
          {/* Focus */}
          <View style={styles.tile}>
            <View style={styles.tileTopRow}>
              <View style={styles.tileIconChip}>
                <Target size={ms(14)} color={COLORS.lightText} strokeWidth={2.2} />
              </View>
              <Text style={styles.tileLabel}>FOCUS</Text>
            </View>
            <View style={styles.tileValueRow}>
              <Text style={styles.tileValueText} numberOfLines={1}>
                {focusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.tileDivider} />

          {/* Impact */}
          <View style={styles.tile}>
            <View style={styles.tileTopRow}>
              <View style={styles.tileIconChip}>
                <Zap size={ms(14)} color={COLORS.lightText} strokeWidth={2.2} />
              </View>
              <Text style={styles.tileLabel}>IMPACT</Text>
            </View>
            <View style={styles.tileValueRow}>
              <Text style={styles.tileValueNum}>+{boostPct}%</Text>
              <Text style={styles.tileValueUnit}>today</Text>
            </View>
          </View>
        </View>
      </Animated.View>
     </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────

// Soft drop-shadow recipe — same as the dashboard cards
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SP[4],
  },

  // Top rail ────────────────────────────────────────────────────
  topRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
    paddingBottom: SP[2],
  },
  railLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  avatarWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    overflow: "hidden",
    backgroundColor: COLORS.iconTileLavender,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  streakStack: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    paddingHorizontal: sw(10),
    paddingVertical: sh(6),
    borderRadius: ms(999),
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(4),
  },
  streakNum: {
    color: COLORS.lightText,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    letterSpacing: -0.1,
  },
  streakUnit: {
    color: COLORS.lightSub,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(11),
    letterSpacing: 0.2,
  },
  railIconBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: COLORS.lightCard,
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },

  // Headline block ──────────────────────────────────────────────
  headBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[3],
    gap: SP[3],
  },
  headText: {
    flex: 1,
  },
  headline: {
    color: COLORS.lightText,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(28),
    lineHeight: ms(32),
    letterSpacing: -0.5,
    marginBottom: sh(6),
  },
  subtitle: {
    color: COLORS.lightSub,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    lineHeight: ms(18),
    maxWidth: "95%",
  },
  startSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Black pill — matches START ROUTINE
  startDepthWrap: {
    borderRadius: ms(999),
    backgroundColor: COLORS.ctaBlack,
  },
  startPillFace: {
    borderRadius: ms(999),
    overflow: "hidden",
  },
  startPillGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingHorizontal: sw(20),
    paddingVertical: sh(14),
    borderRadius: ms(999),
    backgroundColor: COLORS.ctaBlack,
  },
  startPillText: {
    color: "#FFFFFF",
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(14),
    letterSpacing: 0.4,
  },

  // Hero ────────────────────────────────────────────────────────
  heroWrap: {
    height: HERO_H,
    width: "100%",
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP[1],
  },
  heroImage: {
    width: SCREEN_W,
    height: HERO_H,
  },
  heroTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,  // killed: no dark vignette on a light bg
  },

  // Stats card ──────────────────────────────────────────────────
  statsCard: {
    marginHorizontal: SP[5],
    marginTop: SP[4],
    marginBottom: SP[4],
    padding: SP[4],
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    ...SOFT_SHADOW,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[3],
  },
  statsTitle: {
    color: COLORS.lightText,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(18),
    letterSpacing: -0.3,
  },
  // Mini Play CTA — black circle
  miniCtaDepthWrap: {
    borderRadius: ms(18),
    backgroundColor: COLORS.ctaBlack,
  },
  miniCtaFace: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    overflow: "hidden",
    backgroundColor: COLORS.ctaBlack,
  },
  miniCtaGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ms(17),
    backgroundColor: COLORS.ctaBlack,
  },
  tileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SP[2],
    borderTopWidth: 1,
    borderTopColor: COLORS.lightHairline,
  },
  tile: {
    flex: 1,
    padding: SP[3],
    minHeight: sh(76),
    justifyContent: "center",
    alignItems: "flex-start",
  },
  tileDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: COLORS.lightHairline,
    marginVertical: SP[2],
  },
  tileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
    marginBottom: SP[2],
  },
  tileIconChip: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    color: COLORS.lightSub,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(11),
    letterSpacing: 0.4,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: sw(4),
  },
  tileValueText: {
    color: COLORS.lightText,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(17),
    letterSpacing: -0.3,
  },
  tileValueNum: {
    color: COLORS.lightText,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(20),
    letterSpacing: -0.4,
  },
  tileValueUnit: {
    color: COLORS.lightSub,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(11),
  },
});
