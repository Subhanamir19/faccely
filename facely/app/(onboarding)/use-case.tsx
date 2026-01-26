// app/(onboarding)/use-case.tsx
import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  AccessibilityState,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";

import T from "@/components/ui/T";
import GlassBtn from "@/components/ui/GlassBtn";
import { useOnboarding } from "@/store/onboarding";

/** Spec tokens (match onboarding visuals) */
const ACCENT = "#B4F34D";
const BG_TOP = "#000000";
const BG_BOTTOM = "#0B0B0B";
const CARD_FILL = "rgba(18,18,18,0.90)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const SUB = "rgba(160,160,160,0.80)";
const TRACK_INACTIVE = "#2A2A2A";
const OUTLINE = "#2D2D2D";

const { width: W } = Dimensions.get("window");
const CARD_W = Math.round(W * 0.86);

type Row = { key: string; label: string };
const OPTIONS: Row[] = [
  { key: "scores", label: "For getting facial scores" },
  { key: "analysis", label: "For getting facial analysis" },
  { key: "routine", label: "For the routine" },
];

export default function UseCaseScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.useCase;

  const rows = useMemo(() => OPTIONS, []);

  const choose = (key: string) => setField("useCase", key);

  const onNext = () => {
    if (!selected) return;
    router.push("/(onboarding)/experience");
  };

  return (
    <View style={styles.screen}>
      {/* Background: pure black gradient with faint diagonal reflection */}
      <LinearGradient
        colors={[BG_TOP, BG_BOTTOM]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["#FFFFFF08", "#00000000"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.diagonalReflection}
      />
      <View pointerEvents="none" style={styles.fakeGrain} />

      <View style={styles.centerWrap}>
        <BlurView intensity={50} tint="dark" style={[styles.card, styles.cardShadow]}>
          {/* Glass fill + border */}
          <View style={[StyleSheet.absoluteFill, styles.cardOverlay]} />
          {/* Top reflective hairline */}
          <View style={styles.cardHairline} />

          {/* Inner content */}
          <View style={styles.inner}>
            {/* Progress: step 1 of 7 (use-case → experience → age → ethnicity → gender → edge → trust) */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(1 / 7) * 100}%` }]} />
            </View>

            <T style={styles.title}>What do you want to use the app for?</T>
            <T style={styles.sub} numberOfLines={2}>
              Pick one
            </T>

            {/* Options */}
            <FlatList
              data={rows}
              keyExtractor={(it) => it.key}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => {
                const active = selected === item.key;
                return (
                  <Pressable
                    onPress={() => choose(item.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active } as AccessibilityState}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && { transform: [{ translateY: 1 }] },
                    ]}
                  >
                    {/* inner bevel */}
                    <View style={styles.optionInner} />

                    {/* left radio dot only when selected */}
                    {active ? (
                      <View style={styles.dotWrap}>
                        <View style={styles.dotOuterActive}>
                          <View style={styles.dotInnerActive} />
                        </View>
                      </View>
                    ) : null}

                    <T style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.label}
                    </T>

                    {/* soft outer glow on iOS only */}
                    {active && Platform.OS === "ios" ? (
                      <View style={styles.optionGlow} pointerEvents="none" />
                    ) : null}
                  </Pressable>
                );
              }}
            />

            {/* CTA */}
            <View style={styles.ctaCol}>
              <View style={styles.ctaRow}>
                <GlassBtn
                  label="Continue"
                  onPress={onNext}
                  variant="primary"
                  height={56}
                  disabled={!selected}
                />
              </View>
            </View>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },

  diagonalReflection: {
    position: "absolute",
    left: -50,
    right: -50,
    top: -80,
    height: 260,
    transform: [{ rotate: "12deg" }],
  },

  fakeGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.0,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: CARD_W,
    borderRadius: 32,
    overflow: "hidden",
  },

  cardShadow: {
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 10 },
        }
      : { elevation: 8 }),
  },

  cardOverlay: {
    backgroundColor: CARD_FILL,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  cardHairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  inner: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },

  progressTrack: {
    height: 8,
    width: "100%",
    borderRadius: 999,
    backgroundColor: TRACK_INACTIVE,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 999,
  },

  title: {
    fontSize: 22,
    lineHeight: 28,
    color: TEXT,
    textAlign: "left",
  },

  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: SUB,
    opacity: 0.8,
    textAlign: "left",
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
  },

  listContainer: {
    paddingTop: 20,
  },

  option: {
    position: "relative",
    width: "100%",
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#1C1C1C",
    borderWidth: 1.5,
    borderColor: OUTLINE,
    justifyContent: "center",
    paddingLeft: 56,
    paddingRight: 20,
    paddingVertical: 16,
    overflow: "hidden",
  },
  optionInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  optionActive: {
    backgroundColor: "#151515",
    borderColor: ACCENT,
  },
  optionGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    shadowColor: ACCENT,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  dotWrap: {
    position: "absolute",
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  dotOuterActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInnerActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },

  optionText: {
    fontSize: 16,
    color: "#EDEDED",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  optionTextActive: {
    color: "#FFFFFF",
  },

  ctaCol: {
    paddingTop: 24,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
  },
});
