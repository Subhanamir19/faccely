// app/(onboarding)/age.tsx
// Vertical age wheel inside the shared sequence-style onboarding shell.
//
// Geometry is taken from the reference recording's age screen: the selected
// value renders at 64, its neighbours at 48 and the outer pair at 28, and the
// rows compress toward the top and bottom edges rather than sitting on an even
// pitch. Measured centres were 80pt above / 69pt below the selected value and
// 147 / 123 at the outer pair, so the pitch is uniform and each row is pulled
// back toward the centre as it travels outward.

import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import Animated, {
  type SharedValue,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { hapticSelection } from "@/lib/haptics";
import { ms, sh } from "@/lib/responsive";
import { useOnboarding } from "@/store/onboarding";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  OrangeScreenTitle,
  ORANGE_ONBOARDING,
} from "@/components/onboarding/OrangeOnboardingLayout";

const PAPER = ORANGE_ONBOARDING.paper;
const MIN_AGE = 13;
const MAX_AGE = 80;
const DEFAULT_AGE = 18;
const AGES: number[] = Array.from(
  { length: MAX_AGE - MIN_AGE + 1 },
  (_, i) => MIN_AGE + i,
);

const ITEM_HEIGHT = sh(74);
const VISIBLE_ROWS = 5;
const FONT_SELECTED = ms(64, 0.3);
const FONT_ADJACENT = ms(48, 0.3);
const FONT_OUTER = ms(28, 0.3);

export default function AgeScreen() {
  const reduceMotion = useReducedMotion();

  const savedAge = useOnboarding((s) => s.data.age);
  const setField = useOnboarding((s) => s.setField);

  const initialAge = useMemo<number>(() => {
    const saved = typeof savedAge === "number" ? savedAge : DEFAULT_AGE;
    return AGES.includes(saved) ? saved : DEFAULT_AGE;
  }, [savedAge]);

  const [age, setAge] = useState<number>(initialAge);

  const initialOffset = (initialAge - MIN_AGE) * ITEM_HEIGHT;
  const scrollY = useSharedValue<number>(initialOffset);
  const settledIndex = useSharedValue<number>(initialAge - MIN_AGE);
  const settleScale = useSharedValue<number>(1);
  const lastIdx = useRef<number>(initialAge - MIN_AGE);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const onMomentumEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(AGES.length - 1, idx));

      if (clamped !== lastIdx.current) {
        lastIdx.current = clamped;
        hapticSelection();
        setAge(AGES[clamped]);
      }

      settledIndex.value = clamped;
      settleScale.value = reduceMotion ? 1 : 0.94;
      if (!reduceMotion) {
        settleScale.value = withSpring(1, {
          damping: 14,
          stiffness: 260,
          mass: 0.5,
        });
      }
    },
    [reduceMotion, settleScale, settledIndex],
  );

  const handleNext = useCallback(() => {
    setField("age", age);
    const dobIso = new Date(new Date().getFullYear() - age, 0, 1)
      .toISOString()
      .slice(0, 10);
    setField("dob", dobIso);
    router.push("/(onboarding)/ethnicity");
  }, [age, setField]);

  return (
    <View style={styles.screen}>
      <OrangeOnboardingLayout
        presentation="sequence"
        stepKey="age"
        scrollable={false}
        footer={
          <OrangePrimaryButton
            label="Continue"
            onPress={handleNext}
            tone="ink"
            uppercase={false}
          />
        }
      >
        <OrangeScreenTitle title="How old are you?" />

        <View style={styles.pickerWrap}>
          <Animated.FlatList
            style={styles.ageList}
            data={AGES}
            keyExtractor={(value) => String(value)}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            disableIntervalMomentum
            decelerationRate="fast"
            contentContainerStyle={styles.ageListContent}
            onScroll={onScroll}
            onMomentumScrollEnd={onMomentumEnd}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            initialScrollIndex={initialAge - MIN_AGE}
            renderItem={({ item, index }) => (
              <AgeItem
                age={item}
                index={index}
                scrollY={scrollY}
                settledIndex={settledIndex}
                settleScale={settleScale}
              />
            )}
          />
        </View>
      </OrangeOnboardingLayout>
    </View>
  );
}

function AgeItem({
  age,
  index,
  scrollY,
  settledIndex,
  settleScale,
}: {
  age: number;
  index: number;
  scrollY: SharedValue<number>;
  settledIndex: SharedValue<number>;
  settleScale: SharedValue<number>;
}) {
  const labelStyle = useAnimatedStyle(() => {
    const offset = scrollY.value / ITEM_HEIGHT - index;
    const distance = Math.abs(offset);

    // 64 / 48 / 28 expressed against the selected size, so one font size drives
    // the whole wheel and the neighbours stay in proportion on every device.
    const scale = interpolate(
      distance,
      [0, 1, 2, 3],
      [1, FONT_ADJACENT / FONT_SELECTED, FONT_OUTER / FONT_SELECTED, 0.3],
      "clamp",
    );
    const opacity = interpolate(distance, [0, 1, 2, 3], [1, 0.4, 0.18, 0], "clamp");

    // Rows travelling away from the centre are pulled back toward it, which is
    // what produces the reference's 80/69 then 147/123 spacing off a flat pitch.
    const pull = interpolate(distance, [0, 1, 2, 3], [0, 0, 14, 34], "clamp");
    const settle = settledIndex.value === index ? settleScale.value : 1;

    return {
      opacity,
      transform: [
        { translateY: offset > 0 ? pull : -pull },
        { scale: scale * settle },
      ],
    };
  });

  return (
    <View style={styles.ageItem}>
      <Animated.Text style={[styles.ageText, labelStyle]}>{age}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAPER,
  },
  pickerWrap: {
    flexGrow: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ageList: {
    flexGrow: 0,
    width: "100%",
    height: ITEM_HEIGHT * VISIBLE_ROWS,
  },
  ageListContent: {
    // Two blank rows at each end so the first and last age can reach the centre.
    paddingVertical: ITEM_HEIGHT * ((VISIBLE_ROWS - 1) / 2),
  },
  ageItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  ageText: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    fontSize: FONT_SELECTED,
    lineHeight: FONT_SELECTED * 1.1,
    letterSpacing: -1,
    color: ORANGE_ONBOARDING.text,
    includeFontPadding: false,
  },
});
