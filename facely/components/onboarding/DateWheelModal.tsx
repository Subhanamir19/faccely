// components/onboarding/DateWheelModal.tsx
// iOS-style 3-column wheel date picker (day / month / year) in a bottom sheet.
// Pure RN (no native deps) — uses ScrollView snap-to-interval.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { hapticSelection } from "@/lib/haptics";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 7; // odd so there's a center row
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const CENTER_OFFSET = Math.floor(VISIBLE_ITEMS / 2);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

type Props = {
  visible: boolean;
  initial: Date;
  minYear?: number;
  maxYear?: number;
  onDone: (date: Date) => void;
  onCancel: () => void;
};

export default function DateWheelModal({
  visible,
  initial,
  minYear = 1940,
  maxYear = new Date().getFullYear() - 5,
  onDone,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();

  const [day, setDay] = useState(initial.getDate());
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = minYear; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const dayCount = daysInMonth(month, year);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  // Clamp day if month/year change reduces month length
  useEffect(() => {
    if (day > dayCount) setDay(dayCount);
  }, [dayCount, day]);

  // Re-sync internal state when modal re-opens with a new `initial`
  useEffect(() => {
    if (visible) {
      setDay(initial.getDate());
      setMonth(initial.getMonth());
      setYear(initial.getFullYear());
    }
  }, [visible, initial]);

  const handleDone = useCallback(() => {
    onDone(new Date(year, month, day));
  }, [year, month, day, onDone]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SP[4] }]}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <T variant="body" color="sub">Cancel</T>
            </Pressable>
            <T variant="bodySemiBold" color="text">Select Birthday</T>
            <Pressable onPress={handleDone} hitSlop={12}>
              <T variant="bodySemiBold" color="text">Done</T>
            </Pressable>
          </View>

          <View style={styles.wheels}>
            {/* Center selection highlight */}
            <View pointerEvents="none" style={styles.centerBand} />

            <Wheel
              items={days.map(String)}
              selectedIndex={day - 1}
              onChange={(i) => setDay(i + 1)}
              align="right"
            />
            <Wheel
              items={MONTHS}
              selectedIndex={month}
              onChange={(i) => setMonth(i)}
              align="center"
              flex={1.4}
            />
            <Wheel
              items={years.map(String)}
              selectedIndex={year - minYear}
              onChange={(i) => setYear(minYear + i)}
              align="left"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Wheel({
  items,
  selectedIndex,
  onChange,
  align = "center",
  flex = 1,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  align?: "left" | "center" | "right";
  flex?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const lastIndex = useRef(selectedIndex);

  // Jump to selected when items change (e.g. day count changes)
  useEffect(() => {
    const idx = Math.min(selectedIndex, items.length - 1);
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    lastIndex.current = idx;
  }, [selectedIndex, items.length]);

  const handleMomentumEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== lastIndex.current) {
      lastIndex.current = clamped;
      hapticSelection();
      onChange(clamped);
    }
    // Snap-correct if off
    ref.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={{ flex, height: WHEEL_HEIGHT }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingVertical: CENTER_OFFSET * ITEM_HEIGHT,
        }}
        nestedScrollEnabled
      >
        {items.map((val, i) => (
          <View
            key={`${val}-${i}`}
            style={[
              styles.item,
              align === "left" && { alignItems: "flex-start" },
              align === "right" && { alignItems: "flex-end" },
            ]}
          >
            <T
              variant="body"
              color={i === selectedIndex ? "text" : "sub"}
              style={{ opacity: i === selectedIndex ? 1 : 0.5 }}
            >
              {val}
            </T>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.modalBackdrop,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#161616",
    borderTopLeftRadius: RADII.card,
    borderTopRightRadius: RADII.card,
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 24 },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: SP[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  wheels: {
    flexDirection: "row",
    marginTop: SP[3],
    position: "relative",
    paddingHorizontal: SP[3],
  },
  centerBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CENTER_OFFSET * ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    backgroundColor: COLORS.whiteGlass,
    borderRadius: RADII.md,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SP[2],
  },
});

export { DateWheelModal };
