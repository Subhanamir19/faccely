import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, Easing } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
import { getExerciseGuide } from "@/lib/exerciseGuideData";
import { POSE_FRAMES, FALLBACK_FRAME } from "@/lib/programAssets";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 380;
const HERO_MARGIN = SP[3]; // horizontal margin around the hero
const HERO_WIDTH = SCREEN_WIDTH - HERO_MARGIN * 2;

const DOT_SIZE = 10;
const DOT_COLOR = "rgba(160,160,160,0.50)";
const DOT_COLOR_CONNECTED = COLORS.accent;
const LINE_COLOR = "rgba(180,243,77,0.30)";
const LINE_WIDTH = 2;
const GUTTER = 28;

/* ── tiny sub-components ─────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function TimelineStepper({
  items,
  connected,
}: {
  items: string[];
  connected: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.stepperWrap}>
      {items.map((text, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <View key={idx} style={styles.stepRow}>
            {/* left gutter: dot + optional line */}
            <View style={styles.stepGutter}>
              <View style={[styles.dot, connected && styles.dotConnected]} />
              {connected && !isLast && <View style={styles.line} />}
            </View>
            {/* right: text */}
            <Text style={styles.stepText}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PaginationDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  if (count <= 1) return null;
  return (
    <View style={styles.paginationRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pageDot,
            i === activeIndex ? styles.pageDotActive : styles.pageDotInactive,
          ]}
        />
      ))}
    </View>
  );
}

/* ── main screen ─────────────────────────────────────── */

export default function ExerciseGuideScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const insets = useSafeAreaInsets();
  const [activeSlide, setActiveSlide] = useState(0);

  const guide = exerciseId ? getExerciseGuide(exerciseId) : null;
  const frames = exerciseId
    ? POSE_FRAMES[exerciseId] ?? [FALLBACK_FRAME]
    : [FALLBACK_FRAME];

  const onCarouselScroll = useRef(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offsetX / HERO_WIDTH);
      setActiveSlide(idx);
    }
  ).current;

  /* ── no guide fallback ── */
  if (!guide) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.fallbackCenter}>
          <Text style={styles.fallbackText}>No guide available.</Text>
          <Pressable onPress={() => router.back()} style={styles.fallbackBack}>
            <Text style={styles.fallbackBackText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SP[10] + insets.bottom }}
      >
        {/* ── Hero photo carousel ── */}
        <View style={[styles.heroWrap, { marginTop: insets.top + SP[2] }]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onMomentumScrollEnd={onCarouselScroll}
            style={styles.heroList}
          >
            {frames.map((frame, i) => (
              <View key={i} style={styles.heroSlide}>
                <Image source={frame} style={styles.heroImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          {/* Pagination dots */}
          <PaginationDots count={frames.length} activeIndex={activeSlide} />

          {/* Close (X) button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeBtn,
              { top: SP[3] },
              pressed && styles.closeBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ── Content area ── */}
        <Animated.View
          entering={FadeInDown.duration(350).easing(Easing.out(Easing.cubic))}
          style={styles.content}
        >
          {/* Exercise name */}
          <Text style={styles.exerciseName}>{guide.name}</Text>

          {/* INSTRUCTIONS */}
          <SectionLabel label="INSTRUCTIONS" />
          <TimelineStepper items={guide.howTo} connected />

          {/* TIPS */}
          {guide.tips.length > 0 && (
            <>
              <SectionLabel label="TIPS" />
              <TimelineStepper items={guide.tips} connected={false} />
            </>
          )}

          {/* DETAILS */}
          <SectionLabel label="DETAILS" />
          <TimelineStepper
            items={[
              `Hold: ${guide.holdTime}`,
              `Reps: ${guide.reps}`,
              `Frequency: ${guide.frequency}`,
            ]}
            connected={false}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ── styles ──────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },

  /* hero carousel */
  heroWrap: {
    marginHorizontal: HERO_MARGIN,
    height: HERO_HEIGHT,
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
    position: "relative",
  },
  heroList: {
    flex: 1,
  },
  heroSlide: {
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  heroImage: {
    width: "90%",
    height: "90%",
  },

  /* close button */
  closeBtn: {
    position: "absolute",
    right: SP[3],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(100,100,100,0.60)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: {
    transform: [{ scale: 0.93 }],
    opacity: 0.85,
  },

  /* pagination */
  paginationRow: {
    position: "absolute",
    bottom: SP[3],
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pageDotActive: {
    backgroundColor: "#FFFFFF",
  },
  pageDotInactive: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  /* content area */
  content: {
    paddingHorizontal: SP[4],
  },

  exerciseName: {
    ...TYPE.h2,
    color: COLORS.text,
    marginTop: SP[5],
  },

  /* section label */
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.sub,
    fontFamily: "Poppins-SemiBold",
    marginTop: SP[6],
    marginBottom: SP[3],
  },

  /* timeline stepper */
  stepperWrap: {
    gap: 0,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: DOT_SIZE + SP[4],
  },
  stepGutter: {
    width: GUTTER,
    alignItems: "center",
    paddingTop: 6, // vertically center dot with first line of text
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
    zIndex: 1,
  },
  dotConnected: {
    backgroundColor: DOT_COLOR_CONNECTED,
  },
  line: {
    width: LINE_WIDTH,
    flex: 1,
    backgroundColor: LINE_COLOR,
    marginTop: 0,
    minHeight: SP[4],
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
    paddingBottom: SP[4],
  },

  /* fallback */
  fallbackCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
  },
  fallbackText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  fallbackBack: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  fallbackBackText: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
});
