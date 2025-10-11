// app/(onboarding)/ethnicity.tsx
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
import { COLORS, RADII, SP, BLUR } from "@/lib/tokens";

/** Spec constants */
const ACCENT = COLORS.accent; // #B4F34D
const BG_TOP = COLORS.bgTop; // #000000
const BG_BOTTOM = COLORS.bgBottom; // #0B0B0B
const CARD_FILL = COLORS.card; // rgba(18,18,18,0.90)
const CARD_BORDER = COLORS.cardBorder; // rgba(255,255,255,0.08)
const TEXT = COLORS.text; // #FFFFFF
const SUB = COLORS.sub; // rgba(160,160,160,0.80)
const TRACK_INACTIVE = COLORS.track; // #2A2A2A
const OUTLINE = COLORS.outline; // #2D2D2D

const { width: W } = Dimensions.get("window");
const CARD_W = Math.round(W * 0.86);

const OPTIONS = [
  "Asian",
  "African",
  "Caucasian",
  "Hispanic / Latino",
  "Middle Eastern",
  "Mixed / Other",
  "Prefer not to say",
];

export default function EthnicityScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.ethnicity;

  const rows = useMemo(() => OPTIONS.map(label => ({ key: label, label })), []);

  const onNext = () => {
    if (!selected) return;
    router.push("/(onboarding)/gender");
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
      {/* Optional grain layer (stub). Replace with an Image and set opacity ~0.02 if you add a noise asset */}
      <View pointerEvents="none" style={styles.fakeGrain} />

      <View style={styles.centerWrap}>
        <BlurView intensity={mapBlurToIntensity(BLUR.card)} tint="dark" style={[styles.card, styles.cardShadow]}>
          {/* Glass overlay */}
          <View style={[StyleSheet.absoluteFill, styles.cardOverlay]} />
          {/* Top reflective hairline */}
          <View style={styles.cardHairline} />

          {/* Inner content with 24 px padding */}
          <View style={styles.inner}>
            {/* Progress (8 px), then 16 gap */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: "30%" }]} />
            </View>

            <T style={styles.title}>What’s your ethnicity?</T>
            <T style={styles.sub} numberOfLines={3}>
              Optional. We use this to calibrate benchmarks; it doesn’t change your score.
            </T>

            {/* Options: 20 gap above, 12 between items */}
            <FlatList
              data={rows}
              keyExtractor={(it) => it.key}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => {
                const active = selected === item.label;
                return (
                  <Pressable
                    onPress={() => setField("ethnicity", item.label)}
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

                    {/* left radio dot ONLY when selected */}
                    {active ? (
                      <View style={styles.dotWrap}>
                        <View style={[styles.dotOuterActive]}>
                          <View style={styles.dotInnerActive} />
                        </View>
                      </View>
                    ) : null}

                    <T style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.label}
                    </T>

                    {/* soft outer glow only when selected (iOS shadow to avoid Android elevation) */}
                    {active && Platform.OS === "ios" ? (
                      <View style={styles.optionGlow} pointerEvents="none" />
                    ) : null}
                  </Pressable>
                );
              }}
            />

            {/* CTAs: 24 gap above, then 12 between Next and Skip, 24 bottom inset */}
            <View style={styles.ctaCol}>
              <View style={styles.ctaRow}>
                <GlassBtn
                  label="Next"
                  onPress={onNext}
                  variant="primary"
                  height={56}
                  disabled={!selected}
                />
              </View>

              <View style={[styles.ctaRow, { marginBottom: 0 }]}>
                <GlassBtn
                  label="Skip"
                  onPress={() => router.push("/(onboarding)/gender")}
                  variant="glass"
                  height={56}
                />
              </View>
            </View>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

/** expo-blur intensity is 0..100 heuristic; BLUR.card is px semantic */
function mapBlurToIntensity(px: number) {
  if (px <= 10) return 40;
  if (px >= 20) return 70;
  return 55; // ~15 px
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
    borderRadius: RADII.card, // 32
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
    paddingHorizontal: SP[6], // 24
    paddingTop: SP[6],        // top inset
    paddingBottom: SP[6],     // bottom inset 24
  },

  // Progress: exactly 8 px, flush with inner padding
  progressTrack: {
    height: 8,
    width: "100%",
    borderRadius: RADII.circle,
    backgroundColor: TRACK_INACTIVE,
    overflow: "hidden",
    marginBottom: SP[4], // 16 gap to title
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: RADII.circle,
  },

  title: {
    fontSize: 22,
    lineHeight: 28,
    color: TEXT,
    textAlign: "left",
  },

  sub: {
    marginTop: SP[2], // 8
    fontSize: 14,
    lineHeight: 20,
    color: SUB,
    textAlign: "left",
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
    opacity: 0.8,
  },

  listContainer: {
    paddingTop: SP[5], // 20 before options
  },

  option: {
    position: "relative",
    width: "100%",
    height: 56,
    borderRadius: 18,
    backgroundColor: "#1C1C1C",
    borderWidth: 1.5,
    borderColor: OUTLINE, // #2D2D2D
    justifyContent: "center",
    paddingLeft: 56, // room for dot when active
    paddingRight: 20,
    overflow: "hidden",
  },
  optionInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)", // faint bevel
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
    paddingTop: SP[6], // 24 before Next
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12, // Next→12→Skip
  },
});
