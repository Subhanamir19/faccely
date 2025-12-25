import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { ApiResponseError } from "@/lib/api/client";
import Screen from "@/components/layout/Screen";
import PillNavButton from "@/components/ui/PillNavButton";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useProgramStore } from "@/store/program";

type DayState = "today" | "past-complete" | "past-incomplete" | "future-locked";

const LEVEL_NAMES = [
  "Awakening",
  "Foundation",
  "Momentum",
  "Strength",
  "Mastery",
  "Refinement",
  "Elevation",
  "Transcendence",
  "Dominance",
  "Apex",
];

const DAYS_PER_LEVEL = 7;
const TOTAL_LEVELS = 10;

// Circle sizes
const MAX_CIRCLE_SIZE = 42;
const MIN_CIRCLE_SIZE = 34;
const MIN_GAP = 8;
const TROPHY_SCALE = 0.9;
const LINE_HEIGHT = 2;

type DayData = {
  dayNumber: number;
  dayInLevel: number;
  state: DayState;
  isRecovery: boolean;
  completedCount: number;
  total: number;
  disabled: boolean;
};

type LevelData = {
  levelNumber: number;
  levelName: string;
  days: DayData[];
  completedDays: number;
  totalDays: number;
  isCurrentLevel: boolean;
  isLocked: boolean;
  isPast: boolean;
};

type DayRowProps = {
  days: DayData[];
  showTrophy?: boolean;
  isLevelComplete?: boolean;
  direction?: "ltr" | "rtl";
  onDayPress: (dayNumber: number) => void;
  availableWidth: number;
};

function DayRow({
  days,
  showTrophy,
  isLevelComplete,
  direction = "ltr",
  onDayPress,
  availableWidth,
}: DayRowProps) {
  const slotCount = 4;

  let circleSize = MAX_CIRCLE_SIZE;
  let gap = Math.floor((availableWidth - slotCount * circleSize) / (slotCount + 1));
  if (gap < MIN_GAP) {
    circleSize = Math.floor((availableWidth - MIN_GAP * (slotCount + 1)) / slotCount);
    circleSize = Math.max(MIN_CIRCLE_SIZE, Math.min(MAX_CIRCLE_SIZE, circleSize));
    gap = Math.floor((availableWidth - slotCount * circleSize) / (slotCount + 1));
  }
  gap = Math.max(4, gap);

  const trophySize = Math.max(24, Math.round(circleSize * TROPHY_SCALE));
  const startSlot = direction === "rtl" ? slotCount - 1 : 0;
  const trophySlot = direction === "rtl" ? 0 : slotCount - 1;

  const getSlotX = (slot: number) => gap + slot * (circleSize + gap) + circleSize / 2;
  const getSlotLeft = (slot: number) => gap + slot * (circleSize + gap);
  const slotForDayIndex = (index: number) => (direction === "rtl" ? slotCount - 1 - index : index);

  // Find where completed section ends
  const lastCompletedIndex = days.findIndex(d => d.state !== "past-complete");
  const completedCount = lastCompletedIndex === -1 ? days.length : lastCompletedIndex;

  const svgHeight = circleSize;
  const circleY = circleSize / 2;
  const endSlot = showTrophy ? trophySlot : slotForDayIndex(days.length - 1);

  return (
    <View style={styles.dayRowContainer}>
      <Svg width={availableWidth} height={svgHeight}>
        <Defs>
          <LinearGradient id="purpleGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#9333ea" stopOpacity="1" />
            <Stop offset="1" stopColor="#c026d3" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background dashed line connecting all items */}
        <Line
          x1={getSlotX(startSlot)}
          y1={circleY}
          x2={getSlotX(endSlot)}
          y2={circleY}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={LINE_HEIGHT}
          strokeDasharray="8,4"
        />

        {/* Completed solid line */}
        {(showTrophy && isLevelComplete) || completedCount > 1 ? (
          <Line
            x1={getSlotX(startSlot)}
            y1={circleY}
            x2={
              showTrophy && isLevelComplete
                ? getSlotX(trophySlot)
                : getSlotX(slotForDayIndex(completedCount - 1))
            }
            y2={circleY}
            stroke="url(#purpleGradient)"
            strokeWidth={LINE_HEIGHT}
          />
        ) : null}

        {/* Day Circles */}
        {days.map((day, index) => {
          const cx = getSlotX(slotForDayIndex(index));
          const isToday = day.state === "today";
          const isComplete = day.state === "past-complete";
          const isLocked = day.state === "future-locked";
          const radius = circleSize / 2 - 2;

          return (
            <React.Fragment key={day.dayNumber}>
              {/* Outer glow for completed */}
              {isComplete && (
                <Circle
                  cx={cx}
                  cy={circleY}
                  r={radius + 3}
                  fill="rgba(147, 51, 234, 0.25)"
                />
              )}

              {/* Main circle */}
              <Circle
                cx={cx}
                cy={circleY}
                r={radius}
                fill={isComplete ? "url(#purpleGradient)" : "rgba(30,30,35,0.9)"}
                stroke={
                  isComplete ? "#c026d3" :
                  isToday ? "#9333ea" :
                  "rgba(255,255,255,0.2)"
                }
                strokeWidth={isToday ? 2.5 : 1.5}
                strokeDasharray={isLocked ? "5,3" : undefined}
              />
            </React.Fragment>
          );
        })}

        {/* Trophy Circle (only in second row) */}
        {showTrophy && (
          <Circle
            cx={getSlotX(trophySlot)}
            cy={circleY}
            r={trophySize / 2 - 2}
            fill={isLevelComplete ? "rgba(251, 191, 36, 0.2)" : "rgba(30,30,35,0.9)"}
            stroke={isLevelComplete ? "#fbbf24" : "rgba(255,255,255,0.2)"}
            strokeWidth={1.5}
            strokeDasharray={isLevelComplete ? undefined : "5,3"}
          />
        )}
      </Svg>

      {/* Pressable overlays and labels */}
      <View style={[styles.dayOverlayRow, { width: availableWidth }]}>
        {days.map((day, index) => {
          const left = getSlotLeft(slotForDayIndex(index));
          const isToday = day.state === "today";
          const isComplete = day.state === "past-complete";
          const isLocked = day.state === "future-locked";

          return (
            <Pressable
              key={day.dayNumber}
              onPress={() => !day.disabled && onDayPress(day.dayNumber)}
              disabled={day.disabled}
              style={[
                styles.dayPressable,
                {
                  left,
                  top: 0,
                  width: circleSize,
                  height: circleSize,
                },
              ]}
            >
              {/* Day label or fire emoji inside circle */}
              {isToday ? (
                <Text style={styles.fireEmoji}>🔥</Text>
              ) : (
                <Text
                  style={[
                    styles.dayNumber,
                    isComplete && styles.dayNumberComplete,
                    isLocked && styles.dayNumberLocked,
                  ]}
                >
                  Day {day.dayInLevel}
                </Text>
              )}
            </Pressable>
          );
        })}

        {/* Trophy (only in second row) */}
        {showTrophy && (
          <View
            style={[
              styles.trophyPressable,
              {
                left: getSlotLeft(trophySlot) + (circleSize - trophySize) / 2,
                top: (circleSize - trophySize) / 2,
                width: trophySize,
                height: trophySize,
              },
            ]}
          >
            <Text style={[styles.trophyEmoji, !isLevelComplete && styles.trophyLocked]}>
              🏆
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type LevelSectionProps = {
  level: LevelData;
  onDayPress: (dayNumber: number) => void;
  availableWidth: number;
};

function LevelSection({ level, onDayPress, availableWidth }: LevelSectionProps) {
  const progress = level.totalDays > 0 ? level.completedDays / level.totalDays : 0;
  const isAllComplete = level.completedDays === level.totalDays && level.totalDays > 0;

  // Split days: Row 1 = days 1-4, Row 2 = days 5-7
  const row1Days = level.days.slice(0, 4);
  const row2Days = level.days.slice(4, 7);

  return (
    <View
      style={[
        styles.levelSection,
        level.isCurrentLevel && styles.levelSectionCurrent,
        level.isLocked && styles.levelSectionLocked,
        isAllComplete && styles.levelSectionComplete,
      ]}
    >
      {/* Header Image for Level 1 */}
      {level.levelNumber === 1 && (
        <Image
          source={require("@/assets/program-header.png")}
          style={styles.levelHeaderImage}
          resizeMode="cover"
        />
      )}

      {/* Level Header */}
      <View style={styles.levelHeader}>
        <View style={styles.levelTitleRow}>
          <Text style={[styles.levelTitle, level.isLocked && styles.levelTitleLocked]}>
            Level {level.levelNumber}
          </Text>
          {isAllComplete && <Text style={styles.checkEmoji}>✓</Text>}
        </View>
        <Text style={styles.levelProgress}>{level.completedDays}/{level.totalDays}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.levelProgressBar}>
        <View
          style={[
            styles.levelProgressFill,
            { width: `${progress * 100}%` },
            isAllComplete && styles.levelProgressFillComplete,
          ]}
        />
      </View>

      {/* Row 1: Days 1-4 */}
      <DayRow
        days={row1Days}
        onDayPress={onDayPress}
        availableWidth={availableWidth}
      />

      {/* Row 2: Days 5-7 + Trophy */}
      <DayRow
        days={row2Days}
        showTrophy
        isLevelComplete={isAllComplete}
        direction="rtl"
        onDayPress={onDayPress}
        availableWidth={availableWidth}
      />

      {/* Level name subtitle */}
      <Text style={styles.levelSubtitle}>{level.levelName}</Text>
    </View>
  );
}

function getContextLine(programType: 1 | 2 | 3 | null): string {
  if (programType === 1) return "Jawline & structural development";
  if (programType === 2) return "Eye symmetry & midface optimization";
  if (programType === 3) return "Skin clarity & facial refinement";
  return "Personalized facial training";
}

export default function ProgramScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { program, programType, completions, todayIndex, fetchLatest, generate, error } =
    useProgramStore();
  const [booting, setBooting] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Available width for rows (screen - padding - card padding)
  const availableWidth = screenWidth - SP[4] * 2 - SP[3] * 2;

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap(forceGenerate = false) {
    setScreenError(null);
    setBooting(true);
    try {
      if (forceGenerate) {
        await generate();
        return;
      }
      await fetchLatest();
    } catch (err: any) {
      if (err instanceof ApiResponseError && err.status === 404) {
        const code = (err.body as any)?.error;
        if (code === "no_history_scores") {
          setRedirecting(true);
          router.replace("/(tabs)/take-picture");
          return;
        }
        try {
          await generate();
          return;
        } catch (genErr: any) {
          if (genErr instanceof ApiResponseError && genErr.status === 404) {
            const genCode = (genErr.body as any)?.error;
            if (genCode === "no_history_scores") {
              setRedirecting(true);
              router.replace("/(tabs)/take-picture");
              return;
            }
          }
          setScreenError(genErr instanceof Error ? genErr.message : "Program generation failed");
        }
      } else {
        setScreenError(err instanceof Error ? err.message : "Program fetch failed");
      }
    } finally {
      setBooting(false);
    }
  }

  const days = program?.days ?? [];

  // Build day data with state information
  const dayData = useMemo(
    () =>
      days.map((d) => {
        const total = d.exercises.length;
        const completedCount = d.exercises.reduce((acc, ex) => {
          const key = `${program?.programId}:${d.dayNumber}:${ex.id}`;
          return acc + (completions[key] ? 1 : 0);
        }, 0);

        const isToday = program ? d.dayNumber === todayIndex + 1 : false;
        const isPast = program ? d.dayNumber < todayIndex + 1 : false;
        const isFuture = program ? d.dayNumber > todayIndex + 1 : false;

        let state: DayState = "future-locked";
        if (isToday) {
          state = "today";
        } else if (isPast) {
          state = completedCount === total ? "past-complete" : "past-incomplete";
        }

        return {
          ...d,
          completedCount,
          total,
          state,
          disabled: isFuture,
        };
      }),
    [days, completions, program, todayIndex]
  );

  // Group days into 10 levels of 7 days each
  const levelData: LevelData[] = useMemo(() => {
    const levels: LevelData[] = [];
    const currentDayNumber = todayIndex + 1;

    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const startDay = i * DAYS_PER_LEVEL + 1;
      const endDay = (i + 1) * DAYS_PER_LEVEL;

      const levelDays = dayData
        .filter((d) => d.dayNumber >= startDay && d.dayNumber <= endDay)
        .map((d) => ({
          ...d,
          dayInLevel: d.dayNumber - startDay + 1,
        }));

      const completedDays = levelDays.filter((d) => d.state === "past-complete").length;
      const isCurrentLevel = currentDayNumber >= startDay && currentDayNumber <= endDay;
      const isLocked = currentDayNumber < startDay;
      const isPast = currentDayNumber > endDay;

      levels.push({
        levelNumber: i + 1,
        levelName: LEVEL_NAMES[i],
        days: levelDays,
        completedDays,
        totalDays: DAYS_PER_LEVEL,
        isCurrentLevel,
        isLocked,
        isPast,
      });
    }

    return levels;
  }, [dayData, todayIndex]);

  function handleDayPress(dayNumber: number) {
    router.push({
      pathname: "/program/[day]",
      params: { day: String(dayNumber) },
    });
  }

  if (redirecting) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.stateText}>Redirecting to face analysis...</Text>
        </View>
      </Screen>
    );
  }

  if (booting) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.stateText}>Loading program...</Text>
        </View>
      </Screen>
    );
  }

  const needsAnalysis = screenError?.includes("no_history") || error?.includes("no_history");

  const emptyState = (
    <View style={styles.center}>
      {needsAnalysis ? (
        <>
          <Text style={styles.emptyTitle}>No Program Yet</Text>
          <Text style={styles.stateText}>
            Run your first face analysis to unlock your personalized 70-day program.
          </Text>
          <PillNavButton
            kind="solid"
            label="Start Analysis"
            onPress={() => router.push("/(tabs)/analysis")}
          />
        </>
      ) : (
        <>
          <Text style={styles.stateText}>
            {screenError ?? error ?? "No program found. Generate one from your latest analysis."}
          </Text>
          <PillNavButton kind="solid" label="Generate program" onPress={() => bootstrap(true)} />
        </>
      )}
    </View>
  );

  // Calculate overall progress
  const totalCompletedDays = levelData.reduce((acc, l) => acc + l.completedDays, 0);
  const overallProgress = Math.round((totalCompletedDays / 70) * 100);

  return (
    <Screen
      scroll={false}
      footer={
        __DEV__ ? (
          <View style={styles.footerRow}>
            <PillNavButton
              kind="ghost"
              label="Regenerate (Dev)"
              onPress={() => bootstrap(true)}
            />
          </View>
        ) : null
      }
    >
      {!program ? (
        emptyState
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>70-Day Program</Text>
              <View style={styles.overallProgressBadge}>
                <Text style={styles.overallProgressText}>{overallProgress}%</Text>
              </View>
            </View>
            <Text style={styles.sub}>{getContextLine(programType)}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>Day {todayIndex + 1}</Text>
                <Text style={styles.statLabel}>Current</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{70 - todayIndex}</Text>
                <Text style={styles.statLabel}>Remaining</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalCompletedDays}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>
          </View>

          {/* Level Sections */}
          <View style={styles.levelsContainer}>
            {levelData.map((level) => (
              <LevelSection
                key={level.levelNumber}
                level={level}
                onDayPress={handleDayPress}
                availableWidth={availableWidth}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Layout
  scrollContent: {
    paddingBottom: SP[6],
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
  },
  stateText: {
    color: COLORS.sub,
    textAlign: "center",
    paddingHorizontal: SP[4],
    lineHeight: 22,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  footerRow: {
    gap: SP[2],
  },

  // Header
  header: {
    gap: SP[3],
    marginBottom: SP[4],
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
  },
  overallProgressBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.pill,
  },
  overallProgressText: {
    color: COLORS.bgBottom,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
  sub: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[3],
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
  },
  statLabel: {
    color: COLORS.sub,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "Poppins-SemiBold",
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.cardBorder,
  },

  // Levels Container
  levelsContainer: {
    gap: SP[3],
  },

  // Level Section
  levelSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[3],
    gap: SP[2],
  },
  levelSectionCurrent: {
    borderColor: "#9333ea",
    borderWidth: 2,
    shadowColor: "#9333ea",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  levelSectionLocked: {
    opacity: 0.5,
  },
  levelSectionComplete: {
    borderColor: "#22c55e",
    backgroundColor: "rgba(34, 197, 94, 0.05)",
  },
  levelHeaderImage: {
    width: "100%",
    height: 120,
    borderRadius: RADII.lg,
    marginBottom: SP[2],
  },

  // Level Header
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  levelTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
  },
  levelTitleLocked: {
    color: COLORS.sub,
  },
  checkEmoji: {
    fontSize: 16,
    color: "#22c55e",
  },
  levelProgress: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
  levelSubtitle: {
    color: COLORS.sub,
    fontSize: 12,
    textAlign: "center",
    marginTop: SP[1],
    fontFamily: "Poppins-SemiBold",
  },

  // Level Progress Bar
  levelProgressBar: {
    height: 4,
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  levelProgressFill: {
    height: "100%",
    backgroundColor: "#9333ea",
    borderRadius: RADII.circle,
  },
  levelProgressFillComplete: {
    backgroundColor: "#22c55e",
  },

  // Day Row
  dayRowContainer: {
    position: "relative",
    marginTop: SP[1],
  },
  dayOverlayRow: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
  },
  dayPressable: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  // Fire emoji (for today's day)
  fireEmoji: {
    fontSize: 18,
  },

  // Day number inside circle
  dayNumber: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  dayNumberComplete: {
    color: "#ffffff",
  },
  dayNumberLocked: {
    color: "rgba(255,255,255,0.4)",
  },

  // Trophy
  trophyPressable: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  trophyEmoji: {
    fontSize: 18,
  },
  trophyLocked: {
    opacity: 0.3,
  },
});
