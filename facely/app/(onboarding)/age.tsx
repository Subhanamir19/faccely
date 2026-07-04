// app/(onboarding)/age.tsx
// Horizontal age picker inside the shared sequence-style onboarding shell.

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
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

import { SP } from "@/lib/tokens";
import { hapticSelection } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";
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

export default function AgeScreen() {
  const { width: winW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const savedAge = useOnboarding((s) => s.data.age);
  const setField = useOnboarding((s) => s.setField);

  const initialAge = useMemo<number>(() => {
    const saved = typeof savedAge === "number" ? savedAge : DEFAULT_AGE;
    return AGES.includes(saved) ? saved : DEFAULT_AGE;
  }, [savedAge]);

  const [age, setAge] = useState<number>(initialAge);

  const itemWidth = sw(80);
  const sidePad = (winW - itemWidth) / 2;
  const initialOffset = (initialAge - MIN_AGE) * itemWidth;

  const scrollX = useSharedValue<number>(initialOffset);
  const settledIndex = useSharedValue<number>(initialAge - MIN_AGE);
  const settleScale = useSharedValue<number>(1);
  const isSettled = useSharedValue<number>(1);
  const lastIdx = useRef<number>(initialAge - MIN_AGE);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const idx = Math.round(x / itemWidth);
      const clamped = Math.max(0, Math.min(AGES.length - 1, idx));

      if (clamped !== lastIdx.current) {
        lastIdx.current = clamped;
        hapticSelection();
        setAge(AGES[clamped]);
      }

      settledIndex.value = clamped;
      isSettled.value = reduceMotion ? 1 : withTiming(1, { duration: 150 });
      settleScale.value = reduceMotion ? 1 : 0.94;
      if (!reduceMotion) {
        settleScale.value = withSpring(1, {
          damping: 14,
          stiffness: 260,
          mass: 0.5,
        });
      }
    },
    [isSettled, itemWidth, reduceMotion, settleScale, settledIndex],
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
        <ScrollView
          style={styles.verticalScroll}
          contentContainerStyle={styles.center}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <OrangeScreenTitle
            title="How old are you?"
            subtitle="Choose the age that matches you today."
          />

          <View style={styles.pickerWrap}>
            <Animated.FlatList
              style={styles.ageList}
              data={AGES}
              keyExtractor={(value) => String(value)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={itemWidth}
              disableIntervalMomentum
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: sidePad }}
              onScroll={onScroll}
              onScrollBeginDrag={() => {
                isSettled.value = reduceMotion ? 1 : withTiming(0, { duration: 90 });
              }}
              onMomentumScrollEnd={onMomentumEnd}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({
                length: itemWidth,
                offset: itemWidth * index,
                index,
              })}
              initialScrollIndex={initialAge - MIN_AGE}
              renderItem={({ item, index }) => (
                <AgeItem
                  age={item}
                  index={index}
                  itemWidth={itemWidth}
                  scrollX={scrollX}
                  settledIndex={settledIndex}
                  settleScale={settleScale}
                  isSettled={isSettled}
                />
              )}
            />
          </View>
        </ScrollView>
      </OrangeOnboardingLayout>
    </View>
  );
}

function AgeItem({
  age,
  index,
  itemWidth,
  scrollX,
  settledIndex,
  settleScale,
  isSettled,
}: {
  age: number;
  index: number;
  itemWidth: number;
  scrollX: SharedValue<number>;
  settledIndex: SharedValue<number>;
  settleScale: SharedValue<number>;
  isSettled: SharedValue<number>;
}) {
  const labelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / itemWidth - index);
    const scale = interpolate(distance, [0, 1, 2], [1, 0.55, 0.45], "clamp");
    const opacity = interpolate(distance, [0, 1, 2], [1, 0.32, 0.14], "clamp");
    const settle = settledIndex.value === index ? settleScale.value : 1;
    return { opacity, transform: [{ scale: scale * settle }] };
  });

  const tickStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / itemWidth - index);
    const lockScale = settledIndex.value === index
      ? interpolate(isSettled.value, [0, 1], [0.72, 1], "clamp")
      : 0.72;

    return {
      opacity: interpolate(distance, [0, 0.6, 1], [1, 0.3, 0], "clamp"),
      transform: [
        { scaleY: interpolate(distance, [0, 1], [1.6, 0.7], "clamp") * lockScale },
      ],
    };
  });

  return (
    <View style={[styles.ageItem, { width: itemWidth }]}>
      <Animated.Text style={[styles.ageText, labelStyle]}>{age}</Animated.Text>
      <Animated.View style={[styles.tick, tickStyle]} />
    </View>
  );
}

const TICK_HEIGHT = ms(20);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAPER,
  },
  verticalScroll: {
    flex: 1,
  },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: SP[3],
  },
  pickerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ageList: {
    flexGrow: 0,
    maxHeight: sh(112),
  },
  ageItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(8),
  },
  ageText: {
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(48),
    lineHeight: ms(56),
    letterSpacing: 0,
    color: ORANGE_ONBOARDING.text,
    includeFontPadding: false,
  },
  tick: {
    marginTop: sh(8),
    width: 2,
    height: TICK_HEIGHT,
    borderRadius: 1,
    backgroundColor: ORANGE_ONBOARDING.orange,
  },
});
