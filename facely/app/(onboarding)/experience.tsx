// app/(onboarding)/experience.tsx
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
  { key: "new", label: "Completely new — never tried one" },
  { key: "tried", label: "Tried one or two — didn't stick" },
  { key: "few", label: "Used a few — inconsistent results" },
  { key: "regular", label: "Regular user — I know the basics" },
  { key: "skeptical", label: "Skeptical — I don't trust most apps" },
  { key: "bad", label: "Had a bad experience — too complicated / felt scammy" },
];

export default function ExperienceScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.looksmaxxingExperience;

  const rows = useMemo(() => OPTIONS, []);

  const choose = (key: string) => setField("looksmaxxingExperience", key);

  const onNext = () => {
    if (!selected) return;
    // Continue to the next existing onboarding step (age)
    router.push({ pathname: "/(onboarding)/age", params: { autofocus: "1" } });
  };

  const onBack = () => {
    router.back();
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
            {/* Progress: step 2 of 7 */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(2 / 7) * 100}%` }]} />
            </View>

            {/* Back button */}
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.backButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <T style={styles.backButtonText}>← Back</T>
            </Pressable>

            <T style={styles.title}>What's your experience with Looksmaxxing apps?</T>
            <T style={styles.sub} numberOfLines={2}>
              Pick one
            </T>

            {/* Options - scrollable since there are 6 */}
            <FlatList
              data={rows}
              keyExtractor={(it) => it.key}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={styles.listContainer}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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

                    <T
                      style={[styles.optionText, active && styles.optionTextActive]}
                      numberOfLines={2}
                    >
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
    maxHeight: "90%",
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

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 14,
    color: SUB,
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
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

  list: {
    maxHeight: 320,
  },

  listContainer: {
    paddingTop: 16,
    paddingBottom: 4,
  },

  option: {
    position: "relative",
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#1C1C1C",
    borderWidth: 1.5,
    borderColor: OUTLINE,
    justifyContent: "center",
    paddingLeft: 52,
    paddingRight: 16,
    paddingVertical: 12,
    overflow: "hidden",
  },
  optionInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  optionActive: {
    backgroundColor: "#151515",
    borderColor: ACCENT,
  },
  optionGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    shadowColor: ACCENT,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  dotWrap: {
    position: "absolute",
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  dotOuterActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInnerActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },

  optionText: {
    fontSize: 14,
    lineHeight: 20,
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
    paddingTop: 20,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
  },
});
