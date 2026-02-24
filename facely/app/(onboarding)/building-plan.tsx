// app/(onboarding)/building-plan.tsx
// Animated "preparing your routine" screen — appears after time-commitment
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, StatusBar, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInDown, ZoomIn, Easing } from "react-native-reanimated";
import Svg, { Path, Line, Ellipse, Circle, G } from "react-native-svg";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";
import { hapticSuccess } from "@/lib/haptics";

/* ─── SVG illustrations ──────────────────────────────────────────────── */

const S = 26; // icon canvas size

function JawlineIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      {/* Head outline */}
      <Path
        d="M 13 3 C 19 3 22 7 22 12 C 22 18 19 22 13 23 C 7 22 4 18 4 12 C 4 7 7 3 13 3 Z"
        fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"
      />
      {/* Bold jawline */}
      <Path
        d="M 6 18 L 9 22 L 13 23 L 17 22 L 20 18"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Chin dot */}
      <Ellipse cx="13" cy="23" rx="1" ry="1" fill={color} />
    </Svg>
  );
}

function HarmonyIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      {/* Left half face */}
      <Path
        d="M 13 3 C 8 3 4 7 4 13 C 4 19 7 23 13 24"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Right half face */}
      <Path
        d="M 13 3 C 18 3 22 7 22 13 C 22 19 19 23 13 24"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Symmetry axis */}
      <Line x1="13" y1="2" x2="13" y2="24" stroke={color} strokeWidth="1" strokeDasharray="2,2" opacity="0.8" />
      {/* Horizontal ratio lines */}
      <Line x1="6" y1="9"  x2="20" y2="9"  stroke={color} strokeWidth="0.8" opacity="0.5" />
      <Line x1="6" y1="15" x2="20" y2="15" stroke={color} strokeWidth="0.8" opacity="0.5" />
    </Svg>
  );
}

function AngularityIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      {/* Angular face diamond */}
      <Path
        d="M 13 2 L 22 10 L 19 22 L 7 22 L 4 10 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Inner jaw chevron */}
      <Path
        d="M 7 22 L 13 17 L 19 22"
        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Angle marks at cheekbones */}
      <Path d="M 4 10 L 8 13" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <Path d="M 22 10 L 18 13" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </Svg>
  );
}

function SkinIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      {/* Droplet */}
      <Path
        d="M 13 4 C 13 4 20 13 20 17 A 7 7 0 0 1 6 17 C 6 13 13 4 13 4 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Sparkle — 4-pointed star top-right */}
      <Line x1="19" y1="4" x2="19" y2="9"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16.5" y1="6.5" x2="21.5" y2="6.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Small shine inside droplet */}
      <Path
        d="M 10 14 Q 11 12 12 13"
        fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6"
      />
    </Svg>
  );
}

function MorningIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      {/* Horizon line */}
      <Line x1="2" y1="18" x2="24" y2="18" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* Half-sun arc */}
      <Path
        d="M 5 18 A 8 8 0 0 1 21 18"
        fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Rays above horizon */}
      <Line x1="13" y1="2"  x2="13" y2="5"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="5"  y1="6"  x2="7"  y2="8"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="21" y1="6"  x2="19" y2="8"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="2"  y1="11" x2="4"  y2="12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <Line x1="24" y1="11" x2="22" y2="12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

function EveningIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      {/* Crescent moon — outer arc */}
      <Path
        d="M 20 8 A 10 10 0 1 1 8 20 A 7 7 0 0 0 20 8 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Stars */}
      <Ellipse cx="21" cy="5"  rx="1.2" ry="1.2" fill={color} />
      <Ellipse cx="24" cy="11" rx="0.8" ry="0.8" fill={color} opacity="0.7" />
      <Ellipse cx="18" cy="2"  rx="0.7" ry="0.7" fill={color} opacity="0.5" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15">
      <Path
        d="M 2.5 7.5 L 6 11 L 12.5 4"
        fill="none"
        stroke="#0B0B0B"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ─── Item definitions ───────────────────────────────────────────────── */

type ItemDef = {
  label: string;
  sub: string;
  color: string;
  Icon: React.ComponentType<{ color: string }>;
};

const ITEMS: ItemDef[] = [
  { label: "Jawline Improvement",  sub: "12 exercises",  color: "#FF8C42", Icon: JawlineIcon    },
  { label: "Facial Harmony",       sub: "8 exercises",   color: "#8B5CF6", Icon: HarmonyIcon    },
  { label: "Facial Angularity",    sub: "10 exercises",  color: "#3B82F6", Icon: AngularityIcon },
  { label: "Skin Enhancement",     sub: "6 techniques",  color: "#10B981", Icon: SkinIcon       },
  { label: "Morning Protocol",     sub: "5 min / day",   color: "#F59E0B", Icon: MorningIcon    },
  { label: "Evening Exercises",    sub: "10 min / day",  color: "#60A5FA", Icon: EveningIcon    },
];

/* ─── Timing ─────────────────────────────────────────────────────────── */

const STAGGER_MS      = 520;  // gap between each card sliding in
const FIRST_MS        = 600;  // delay before first card appears
const CARD_DURATION   = 500;  // how long each card slide-in takes
// Checkmark pops in after the card has mostly settled
const CHECK_OFFSET_MS = 380;
// CTA appears after last card fully lands + breathing room
const CTA_DELAY_MS    = FIRST_MS + (ITEMS.length - 1) * STAGGER_MS + CARD_DURATION + 500; // ≈ 4300ms

/* ─── Status cycling text ────────────────────────────────────────────── */

const STATUS_TEXTS = [
  "Calculating your facial angles…",
  "Checking skin quality metrics…",
  "Mapping facial symmetry…",
  "Adapting routine to your goals…",
  "Calibrating exercise intensity…",
  "Personalising your morning routine…",
  "Your routine is ready ✓",
] as const;

const CYCLE_MS = 1300;

/* ─── Screen ─────────────────────────────────────────────────────────── */

export default function BuildingPlanScreen() {
  const insets = useSafeAreaInsets();
  const { devPreview, setDevPreview } = useOnboarding();

  const [statusIdx, setStatusIdx] = useState(0);
  const [ctaVisible, setCtaVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setStatusIdx((prev) => {
        const next = prev + 1;
        if (next >= STATUS_TEXTS.length - 1) {
          clearInterval(intervalRef.current!);
          return STATUS_TEXTS.length - 1;
        }
        return next;
      });
    }, CYCLE_MS);

    const ctaTimer = setTimeout(() => setCtaVisible(true), CTA_DELAY_MS);

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(ctaTimer);
    };
  }, []);

  const handleContinue = useCallback(() => {
    hapticSuccess();
    if (devPreview) {
      setDevPreview(false);
      router.replace("/(tabs)/take-picture");
    } else {
      router.push("/(auth)/login");
    }
  }, [devPreview, setDevPreview]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Progress bar */}
      <View style={[styles.progressTrack, { marginTop: insets.top + SP[3] }]}>
        <View style={[styles.progressFill, { width: "100%" }]} />
      </View>

      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
        style={styles.header}
      >
        <T variant="h2" color="text">
          We're Preparing Your{"\n"}Personalised Routine…
        </T>
        <T variant="body" color="sub" style={styles.subtitle}>
          Finding the best exercises for your unique features
        </T>
      </Animated.View>

      {/* Routine item cards — staggered */}
      <View style={styles.itemList}>
        {ITEMS.map((item, i) => {
          const { Icon } = item;
          return (
            <Animated.View
              key={item.label}
              entering={FadeInDown
                .duration(CARD_DURATION)
                .delay(FIRST_MS + i * STAGGER_MS)
                .easing(Easing.out(Easing.cubic))}
              style={styles.itemRow}
            >
              {/* Illustration circle */}
              <View style={[styles.iconCircle, { backgroundColor: item.color + "20" }]}>
                <Icon color={item.color} />
              </View>

              {/* Labels */}
              <View style={styles.itemText}>
                <T style={styles.itemLabel}>{item.label}</T>
                <T style={styles.itemSub}>{item.sub}</T>
              </View>

              {/* Checkmark — springs in after the card settles */}
              <Animated.View
                style={styles.checkCircle}
                entering={ZoomIn
                  .duration(400)
                  .delay(FIRST_MS + i * STAGGER_MS + CHECK_OFFSET_MS)
                  .springify()
                  .damping(16)
                  .stiffness(160)}
              >
                <CheckIcon />
              </Animated.View>
            </Animated.View>
          );
        })}
      </View>

      {/* Cycling status text */}
      <View style={styles.statusWrap}>
        <Animated.View key={statusIdx} entering={FadeIn.duration(300)}>
          <T style={styles.statusText}>{STATUS_TEXTS[statusIdx]}</T>
        </Animated.View>
      </View>

      {/* CTA — appears after all items load */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + SP[4] }]}>
        {ctaVisible && (
          <Animated.View
            entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
            style={styles.ctaShadow}
          >
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.ctaInner,
                { transform: [{ translateY: pressed ? 5 : 0 }] },
              ]}
            >
              <LinearGradient
                colors={["#CCFF6B", "#B4F34D"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.ctaGradient}
              >
                <T style={styles.ctaText}>View My Custom Routine</T>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgTop },

  progressTrack: {
    height: 8,
    marginHorizontal: SP[6],
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginBottom: SP[4],
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },

  header: { paddingHorizontal: SP[6], marginBottom: SP[4] },
  subtitle: { marginTop: SP[2] },

  itemList: {
    flex: 1,
    paddingHorizontal: SP[6],
    gap: SP[3],
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SP[4],
    paddingVertical: SP[3] + 2,
    gap: SP[4],
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemText: { flex: 1 },
  itemLabel: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textHigh,
  },
  itemSub: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.sub,
    opacity: 0.65,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  statusWrap: {
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    alignItems: "center",
  },
  statusText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.sub,
    opacity: 0.5,
    textAlign: "center",
  },

  ctaContainer: { paddingHorizontal: SP[6], paddingTop: SP[2] },
  ctaShadow: {
    borderRadius: 28,
    backgroundColor: "#6B9A1E",
    paddingBottom: 6,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  ctaInner: { height: 56, borderRadius: 28, overflow: "hidden" },
  ctaGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  ctaText: {
    color: COLORS.bgTop,
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
  },
});
