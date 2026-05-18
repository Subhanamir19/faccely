// components/program/WorkoutPreview.tsx
// Preview screen shown on tab focus before the exercise list.
// UI-only surface: keeps the existing routine/progress/profile/session behavior.

import React from "react";
import {
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  CircleCheck,
  Clock3,
  Dumbbell,
  Flame,
  Play,
  RotateCcw,
  Target,
  TrendingUp,
  User as UserIcon,
  Zap,
} from "lucide-react-native";

import SpeechBubble from "./SpeechBubble";

import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import {
  CARD_FACE_IMAGES,
  CARD_FACE_LABELS,
  aggregateIntensity,
  intensityBoostPct,
  resolveCardTarget,
} from "@/lib/faceTargets";
import { getExerciseIcon } from "@/lib/exerciseIcons";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { useProfile } from "@/store/profile";
import { type DailyTask, useTasksStore } from "@/store/tasks";

const { height: SCREEN_H } = Dimensions.get("window");
const PAGE_X = SP[5];
const HERO_H = Math.min(Math.round(SCREEN_H * 0.42), sh(336));

const GREEN = "#58BF19";
const GREEN_SOFT = "#EFFAE9";
const SURFACE = "#FFFFFF";
const TEXT = "#111111";
const SUB = "#5E625F";
const HAIRLINE = "rgba(17,17,17,0.08)";

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

const IMPACT_BUBBLE_TEXT: Record<string, string> = {
  jawline: "strengthens\nlower face",
  cheekbones: "sculpts your\nmidface",
  eyes: "lifts the\neye area",
  skin: "boosts\nskin tone",
  nose: "refines\nnose contour",
  all: "full face\nactivation",
};

function buildSubtitle(
  target: string,
  intensity: "high" | "medium" | "low",
  totalMins: number,
): string {
  const region = (CARD_FACE_LABELS[target] ?? "full face").toLowerCase();
  const verb = intensity === "high" ? "Intense" : intensity === "low" ? "Gentle" : "Sculpting";
  return `${verb} ${region} session. ${totalMins} focused minutes to move the needle.`;
}

function UserAvatar({
  uri,
  size,
}: {
  uri: string | null;
  size: number;
}) {
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: radius }]}>
      <UserIcon size={Math.round(size * 0.48)} color="#8F9891" strokeWidth={2.1} />
    </View>
  );
}

export default function WorkoutPreview({
  tasks,
  onStart,
}: {
  tasks: DailyTask[];
  onStart: () => void;
}) {
  const { currentStreak } = useTasksStore();
  const { avatarUri, displayName } = useProfile();
  const { getDuration } = useExerciseSettings();

  const firstName = displayName?.split(" ")[0] ?? "there";
  const cardTarget = resolveCardTarget(tasks);
  const faceImage = CARD_FACE_IMAGES[cardTarget] ?? CARD_FACE_IMAGES.cheekbones;
  const focusLabel = CARD_FACE_LABELS[cardTarget] ?? "Full Face";
  const intensity = aggregateIntensity(tasks);
  const boostPct = intensityBoostPct(intensity);

  const totalSecs = tasks.reduce((sum, t) => sum + getDuration(t.exerciseId), 0);
  const totalMins = Math.max(1, Math.round(totalSecs / 60));
  const allTasksDone = tasks.length > 0 && tasks.every((t) => t.status !== "pending");
  const isDone = allTasksDone;

  const subtitle = isDone
    ? "You moved the needle today. Rest is part of the program."
    : buildSubtitle(cardTarget, intensity, totalMins);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const streakUnit = currentStreak === 1 ? "day streak" : "days streak";
  const impactText = isDone
    ? "today's lift\nlocked in"
    : (IMPACT_BUBBLE_TEXT[cardTarget] ?? IMPACT_BUBBLE_TEXT.all);
  const timeText = isDone ? "rest now\ngrow tomorrow" : `${totalMins} min\nsession`;

  const goToGuide = (exerciseId: string) => {
    Haptics.selectionAsync();
    router.push(`/program/guide/${exerciseId}`);
  };

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
        <Animated.View entering={FadeIn.duration(400)} style={styles.topRail}>
          <Pressable
            style={styles.profileButton}
            onPress={goToProfile}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <UserAvatar uri={avatarUri} size={ms(40)} />
          </Pressable>

          <Pressable
            style={styles.streakPill}
            onPress={goToProgress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${currentStreak} ${streakUnit}. Open progress`}
          >
            <Flame size={ms(13)} color="#FF7A1A" strokeWidth={2.4} />
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakUnit}>{streakUnit}</Text>
          </Pressable>

          <Pressable
            style={styles.progressButton}
            onPress={goToProgress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open progress"
          >
            <TrendingUp size={ms(18)} color={TEXT} strokeWidth={2.2} />
          </Pressable>
        </Animated.View>

        <View style={styles.headBlock}>
          <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.headText}>
            <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
              Hey, {firstName}!
            </Text>
            <Text style={styles.subtitle} numberOfLines={3}>
              {subtitle}
            </Text>
          </Animated.View>

          {isDone ? (
            <Animated.View
              entering={FadeInDown.delay(160).duration(420)}
              style={styles.doneBadge}
            >
              <CircleCheck size={ms(16)} color={TEXT} strokeWidth={2.2} />
              <Text style={styles.doneBadgeText}>DONE</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(160).duration(420)} style={styles.startSlot}>
              <Pressable
                onPress={handleStart}
                style={({ pressed }) => [styles.startPill, pressed && styles.startPillPressed]}
                accessibilityRole="button"
                accessibilityLabel="Start routine"
              >
                <Play size={ms(13)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
                <Text style={styles.startPillText}>START</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.heroCard}>
          <View style={styles.heroStage}>
            <ExpoImage
              key={`preview-face-${cardTarget}`}
              source={faceImage}
              style={styles.heroSessionAvatar}
              contentFit="contain"
              contentPosition="center"
              transition={300}
              accessibilityLabel={`${focusLabel} session avatar`}
            />
          </View>

          <SpeechBubble
            text={impactText}
            top={sh(20)}
            left={sw(16)}
            delay={260}
            floatPhase={0}
            Icon={Dumbbell}
          />

          <SpeechBubble
            text={timeText}
            top="49%"
            right={sw(16)}
            delay={480}
            floatPhase={900}
            Icon={Clock3}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(320).duration(460)} style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>
              {isDone ? "Today's recap" : "Active Stats"}
            </Text>
            <Pressable
              onPress={goToProgress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View progress"
            >
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.tileRow}>
            {isDone ? (
              <>
                <View style={styles.tile}>
                  <View style={styles.tileIconChip}>
                    <CircleCheck size={ms(15)} color={GREEN} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.tileLabel}>EXERCISES</Text>
                  <View style={styles.tileValueRow}>
                    <Text style={styles.tileValueNum}>{completedCount}</Text>
                    <Text style={styles.tileValueUnit}>of {tasks.length}</Text>
                  </View>
                </View>

                <View style={styles.tile}>
                  <View style={styles.tileIconChip}>
                    <Flame size={ms(15)} color={GREEN} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.tileLabel}>STREAK</Text>
                  <View style={styles.tileValueRow}>
                    <Text style={styles.tileValueNum}>{currentStreak}</Text>
                    <Text style={styles.tileValueUnit}>
                      day{currentStreak === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.tile}>
                  <View style={styles.tileIconChip}>
                    <Target size={ms(15)} color={GREEN} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.tileLabel}>FOCUS</Text>
                  <Text style={styles.tileValueText} numberOfLines={1} adjustsFontSizeToFit>
                    {focusLabel}
                  </Text>
                </View>

                <View style={styles.tile}>
                  <View style={styles.tileIconChip}>
                    <Zap size={ms(15)} color={GREEN} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.tileLabel}>IMPACT</Text>
                  <View style={styles.tileValueRow}>
                    <Text style={styles.tileValueNum}>+{boostPct}%</Text>
                    <Text style={styles.tileValueUnit}>today</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {isDone && tasks.length > 0 && (
          <Animated.View entering={FadeInUp.delay(420).duration(460)} style={styles.rewatchSection}>
            <View style={styles.rewatchHeader}>
              <Text style={styles.rewatchTitle}>Re-watch any exercise</Text>
              <Text style={styles.rewatchCaption}>Refresh the technique. No re-credit needed.</Text>
            </View>

            {tasks.map((task) => (
              <Pressable
                key={task.exerciseId}
                onPress={() => goToGuide(task.exerciseId)}
                style={({ pressed }) => [styles.rewatchRow, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Re-watch ${task.name}`}
              >
                <View style={styles.rewatchIconWrap}>
                  <Image source={getExerciseIcon(task.exerciseId)} style={styles.rewatchIcon} />
                </View>
                <View style={styles.rewatchTextWrap}>
                  <Text style={styles.rewatchName} numberOfLines={1}>
                    {task.name}
                  </Text>
                  <Text style={styles.rewatchSub} numberOfLines={1}>
                    Tap to view technique
                  </Text>
                </View>
                <RotateCcw size={ms(16)} color={COLORS.lightSub} strokeWidth={2} />
              </Pressable>
            ))}
          </Animated.View>
        )}

        {isDone && (
          <Animated.Text entering={FadeIn.delay(560).duration(400)} style={styles.doneFooter}>
            Tomorrow's routine unlocks at midnight.
          </Animated.Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SP[4],
  },

  topRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_X,
    paddingTop: SP[2],
    paddingBottom: SP[2],
  },
  profileButton: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallback: {
    backgroundColor: "#E9EFEC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  streakPill: {
    minHeight: ms(38),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(5),
    paddingHorizontal: sw(15),
    borderRadius: ms(999),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    ...SOFT_SHADOW,
  },
  streakNum: {
    color: "#E85F00",
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
  },
  streakUnit: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
  },
  progressButton: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(16),
    backgroundColor: "#F8F9F8",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },

  headBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PAGE_X,
    paddingTop: SP[3],
    paddingBottom: SP[3],
    gap: SP[3],
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(28),
    lineHeight: ms(32),
    letterSpacing: 0,
    marginBottom: sh(6),
  },
  subtitle: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
    lineHeight: ms(16),
    maxWidth: sw(224),
  },
  startSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  startPill: {
    minWidth: sw(112),
    minHeight: ms(52),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(7),
    paddingHorizontal: sw(19),
    borderRadius: ms(999),
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startPillPressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
  },
  startPillText: {
    color: "#FFFFFF",
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    letterSpacing: 0,
  },
  doneBadge: {
    minHeight: ms(44),
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    paddingHorizontal: sw(14),
    borderRadius: ms(999),
    backgroundColor: "#F0F4EF",
  },
  doneBadgeText: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
    letterSpacing: 0,
  },

  heroCard: {
    height: HERO_H,
    marginHorizontal: PAGE_X,
    marginTop: SP[2],
    borderRadius: ms(18),
    backgroundColor: "#F9FBF8",
    borderWidth: 1,
    borderColor: "#EEF2EC",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    ...SOFT_SHADOW,
  },
  heroStage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#FBFCFA",
  },
  heroSessionAvatar: {
    width: "148%",
    height: "148%",
    marginBottom: -sh(92),
  },

  statsCard: {
    marginHorizontal: PAGE_X,
    marginTop: SP[5],
    marginBottom: SP[4],
    padding: SP[4],
    backgroundColor: GREEN_SOFT,
    borderRadius: ms(18),
    borderWidth: 1,
    borderColor: "#DDEFD6",
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[3],
  },
  statsTitle: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(17),
    letterSpacing: 0,
  },
  viewAllText: {
    color: GREEN,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(11),
    letterSpacing: 0,
  },
  tileRow: {
    flexDirection: "row",
    gap: SP[3],
  },
  tile: {
    flex: 1,
    minHeight: sh(118),
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    borderRadius: ms(12),
    backgroundColor: SURFACE,
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
  },
  tileIconChip: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(9),
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(10),
    letterSpacing: 0,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: sw(4),
  },
  tileValueText: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(18),
    letterSpacing: 0,
    maxWidth: "100%",
  },
  tileValueNum: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(24),
    letterSpacing: 0,
  },
  tileValueUnit: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(11),
  },

  rewatchSection: {
    marginHorizontal: PAGE_X,
    marginBottom: SP[3],
  },
  rewatchHeader: {
    marginBottom: SP[3],
  },
  rewatchTitle: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(16),
    letterSpacing: 0,
    marginBottom: sh(2),
  },
  rewatchCaption: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
    letterSpacing: 0,
  },
  rewatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    paddingVertical: sh(10),
    paddingHorizontal: sw(12),
    borderRadius: RADII.md,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: HAIRLINE,
    marginBottom: sh(8),
    ...SOFT_SHADOW,
  },
  rewatchIconWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(10),
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rewatchIcon: {
    width: ms(28),
    height: ms(28),
    resizeMode: "contain",
  },
  rewatchTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rewatchName: {
    color: TEXT,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(14),
    letterSpacing: 0,
    marginBottom: sh(2),
  },
  rewatchSub: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(11),
    letterSpacing: 0,
  },
  doneFooter: {
    color: SUB,
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
    textAlign: "center",
    paddingHorizontal: PAGE_X,
    paddingTop: SP[2],
    paddingBottom: SP[4],
    letterSpacing: 0,
  },
});
