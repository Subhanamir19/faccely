// app/(onboarding)/age.tsx
// Horizontal age picker — minimal layout per design mockup.
// Top: back chevron + thin progress bar.
// Center: "How old are you?" title above a snap-scrolling age wheel. The
// centered age is rendered large and bold; neighbours fade and shrink
// continuously based on scroll distance, with a vertical tick that grows
// as it nears the centerline.
// Bottom: black-pill Next CTA.
//
// Stores `age` directly. Also derives a Jan-1 `dob` ISO date so any code
// that still reads `data.dob` keeps working without ripple.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, getProgressForStep } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";

const MIN_AGE = 13;
const MAX_AGE = 80;
const DEFAULT_AGE = 18;
const AGES: number[] = Array.from(
  { length: MAX_AGE - MIN_AGE + 1 },
  (_, i) => MIN_AGE + i,
);

export default function AgeScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const savedAge = useOnboarding((s) => s.data.age);
  const setField = useOnboarding((s) => s.setField);

  const initialAge = useMemo<number>(() => {
    const saved = typeof savedAge === "number" ? savedAge : DEFAULT_AGE;
    return AGES.includes(saved) ? saved : DEFAULT_AGE;
  }, [savedAge]);

  const [age, setAge] = useState<number>(initialAge);

  // Card width — five visible at once on a typical 360-wide phone.
  const ITEM_W   = sw(80);
  const sidePad  = (winW - ITEM_W) / 2;
  const initialOffset = (initialAge - MIN_AGE) * ITEM_W;

  const scrollX = useSharedValue<number>(initialOffset);
  const lastIdx = useRef<number>(initialAge - MIN_AGE);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / ITEM_W);
      const clamped = Math.max(0, Math.min(AGES.length - 1, idx));
      if (clamped !== lastIdx.current) {
        lastIdx.current = clamped;
        hapticSelection();
        setAge(AGES[clamped]);
      }
    },
    [ITEM_W],
  );

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const handleNext = useCallback(() => {
    setField("age", age);
    // Derive a Jan-1 dob for callers still reading data.dob.
    const dobIso = new Date(new Date().getFullYear() - age, 0, 1)
      .toISOString()
      .slice(0, 10);
    setField("dob", dobIso);
    router.push("/(onboarding)/ethnicity");
  }, [age, setField]);

  const progress = getProgressForStep("age");

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Top — back chevron above a full-width progress bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + SP[2] }]}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.65 },
          ]}
        >
          <ChevronLeft size={ms(22)} color={COLORS.lightText} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.progressRow}>
          <ProgressBar progress={progress} />
        </View>
      </View>

      {/* Center — title + picker, vertically centered in remaining space */}
      <View style={styles.center}>
        <Animated.Text
          entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))}
          style={styles.title}
        >
          How old are you?
        </Animated.Text>

        <View style={styles.pickerWrap}>
          <Animated.FlatList
            data={AGES}
            keyExtractor={(a) => String(a)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_W}
            disableIntervalMomentum
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePad }}
            onScroll={onScroll}
            onMomentumScrollEnd={onMomentumEnd}
            scrollEventThrottle={16}
            getItemLayout={(_, i) => ({
              length: ITEM_W,
              offset: ITEM_W * i,
              index: i,
            })}
            initialScrollIndex={initialAge - MIN_AGE}
            renderItem={({ item, index }) => (
              <AgeItem
                age={item}
                index={index}
                itemWidth={ITEM_W}
                scrollX={scrollX}
              />
            )}
          />
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.cta,
            pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={styles.ctaText}>NEXT</T>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Single age item — animates by distance from the center indicator ──────

function AgeItem({
  age,
  index,
  itemWidth,
  scrollX,
}: {
  age: number;
  index: number;
  itemWidth: number;
  scrollX: Animated.SharedValue<number>;
}) {
  const labelStyle = useAnimatedStyle(() => {
    const t = Math.abs(scrollX.value / itemWidth - index);
    const scale   = interpolate(t, [0, 1, 2], [1.0, 0.55, 0.45], "clamp");
    const opacity = interpolate(t, [0, 1, 2], [1.0, 0.32, 0.14], "clamp");
    return { opacity, transform: [{ scale }] };
  });

  const tickStyle = useAnimatedStyle(() => {
    const t = Math.abs(scrollX.value / itemWidth - index);
    return {
      opacity: interpolate(t, [0, 0.6, 1], [1, 0.3, 0], "clamp"),
      transform: [
        { scaleY: interpolate(t, [0, 1], [1.6, 0.7], "clamp") },
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

// ─── Progress bar — same vocabulary as OnboardingScreenV2 ──────────────────

function ProgressBar({ progress }: { progress: number }) {
  const w = useSharedValue<number>(0);
  useEffect(() => {
    w.value = withTiming(progress * 100, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

const TICK_HEIGHT = ms(20);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },

  topBar: {
    paddingHorizontal: SP[5],
    paddingBottom: SP[3],
    gap: SP[2],
  },
  backBtn: {
    width: ms(36),
    height: ms(36),
    alignItems: "flex-start",
    justifyContent: "center",
  },
  progressRow: {
    width: "100%",
  },
  progressTrack: {
    width: "100%",
    height: sh(6),
    borderRadius: 999,
    backgroundColor: COLORS.lightHairline,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 999,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
  },
  title: {
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    letterSpacing: -0.5,
    color: COLORS.lightText,
    textAlign: "center",
    marginBottom: sh(48),
  },

  pickerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ageItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(8),
  },
  ageText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(48),
    lineHeight: ms(56),
    letterSpacing: -1.0,
    color: COLORS.lightText,
    includeFontPadding: false,
  },
  tick: {
    marginTop: sh(8),
    width: 2,
    height: TICK_HEIGHT,
    borderRadius: 1,
    backgroundColor: COLORS.lightText,
  },

  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(15),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
