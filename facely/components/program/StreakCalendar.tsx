// components/program/StreakCalendar.tsx
// GitHub-style heatmap showing last 28 days of task completion.

import React, { useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, SP, RADII } from "@/lib/tokens";
import type { DayRecord } from "@/store/tasks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CellState = "completed" | "today" | "missed" | "future" | "placeholder";

interface CalendarCell {
  date: string;
  state: CellState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const GAP = 4;
const OUTER_H = SP[4]; // 16px — screen container horizontal padding
const CARD_H = SP[3];  // 12px — card internal horizontal padding

function getLocalDateString(d?: Date): string {
  const now = d ?? new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function subDays(dateStr: string, n: number): string {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const d = new Date(y, mo - 1, da - n);
  return getLocalDateString(d);
}

// ISO day of week: Monday=1 … Sunday=7
function isoWeekday(dateStr: string): number {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  return d.getDay() === 0 ? 7 : d.getDay(); // Sun→7
}

function getCellState(
  dateStr: string,
  today: DayRecord | null,
  history: DayRecord[],
  todayStr: string
): CellState {
  if (dateStr > todayStr) return "future";

  if (dateStr === todayStr) {
    return today?.streakEarned ? "completed" : "today";
  }

  const record = history.find((r) => r.date === dateStr);
  if (!record) return "missed";
  return record.streakEarned ? "completed" : "missed";
}

function buildCells(
  today: DayRecord | null,
  history: DayRecord[]
): CalendarCell[] {
  const todayStr = getLocalDateString();

  // Build 28 real data cells going back from today
  const dateCells: CalendarCell[] = [];
  for (let i = 27; i >= 0; i--) {
    const dateStr = i === 0 ? todayStr : subDays(todayStr, i);
    dateCells.push({
      date: dateStr,
      state: getCellState(dateStr, today, history, todayStr),
    });
  }

  // Prepend placeholder cells so column 0 = Monday
  const oldestDate = dateCells[0].date;
  const weekday = isoWeekday(oldestDate); // 1 = Mon
  const leadingPlaceholders = weekday - 1; // 0 if already Monday

  const placeholders: CalendarCell[] = Array.from(
    { length: leadingPlaceholders },
    (_, i) => ({ date: `placeholder-${i}`, state: "placeholder" })
  );

  return [...placeholders, ...dateCells];
}

// ---------------------------------------------------------------------------
// Cell component
// ---------------------------------------------------------------------------
function CalendarCell({
  cell,
  size,
  radius,
}: {
  cell: CalendarCell;
  size: number;
  radius: number;
}) {
  const cellStyle = useMemo(() => {
    switch (cell.state) {
      case "completed":
        return {
          backgroundColor: COLORS.accent,
          shadowColor: COLORS.accent,
          shadowOpacity: 0.55,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        };
      case "today":
        return {
          backgroundColor: "rgba(180,243,77,0.18)",
          borderWidth: 1,
          borderColor: COLORS.accent,
        };
      case "missed":
        return {
          backgroundColor: "rgba(255,255,255,0.06)",
        };
      case "future":
        return {
          backgroundColor: "rgba(255,255,255,0.02)",
        };
      case "placeholder":
        return {
          backgroundColor: "transparent",
        };
      default:
        return {};
    }
  }, [cell.state]);

  return (
    <View
      style={[
        styles.cell,
        { width: size, height: size, borderRadius: radius },
        cellStyle,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface StreakCalendarProps {
  history: DayRecord[];
  today: DayRecord | null;
  currentStreak: number;
  bestStreak: number;
}

export default function StreakCalendar({
  history,
  today,
  currentStreak,
  bestStreak,
}: StreakCalendarProps) {
  const { width: screenWidth } = useWindowDimensions();

  const availableWidth = screenWidth - OUTER_H * 2 - CARD_H * 2;
  const cellSize = Math.floor((availableWidth - GAP * 6) / 7);
  const cellRadius = Math.max(5, Math.floor(cellSize * 0.22));

  const cells = useMemo(
    () => buildCells(today, history),
    [today, history]
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(350).delay(90)}
      style={styles.card}
    >
      {/* Day labels row */}
      <View style={[styles.grid, { gap: GAP }]}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={[styles.dayLabel, { width: cellSize }]}>
            <Text style={styles.dayLabelText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Cell grid */}
      <View style={[styles.grid, { gap: GAP, flexWrap: "wrap" }]}>
        {cells.map((cell, i) => (
          <CalendarCell
            key={cell.date + i}
            cell={cell}
            size={cellSize}
            radius={cellRadius}
          />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.streakText}>
          🔥 {currentStreak} day{currentStreak !== 1 ? "s" : ""} streak
        </Text>
        {bestStreak > currentStreak && (
          <Text style={styles.bestText}>Best: {bestStreak} days</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(18,18,18,0.70)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: CARD_H,
    gap: GAP + 2,
  },
  grid: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayLabel: {
    alignItems: "center",
    justifyContent: "center",
    height: 14,
  },
  dayLabelText: {
    color: COLORS.sub,
    fontSize: 9,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  cell: {
    // size, borderRadius applied dynamically
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SP[1],
  },
  streakText: {
    color: "#FFAA32",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  bestText: {
    color: COLORS.sub,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
});
