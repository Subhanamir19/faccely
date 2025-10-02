// app/(onboarding)/ethnicity.tsx
import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ImageBackground,
  Platform,
  AccessibilityState,
} from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import T from "@/components/ui/T";
import { useOnboarding } from "@/store/onboarding";

/** Tokens */
const ACCENT = "#8FA31E";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_DIM = "rgba(255,255,255,0.65)";
const CARD_BORDER = "rgba(255,255,255,0.12)";
const CARD_TINT = "rgba(15,15,15,0.72)";
const TRACK = "rgba(255,255,255,0.12)";
const TRACK_INNER = "rgba(0,0,0,0.35)";
const BUTTON_TRACK = "rgba(255,255,255,0.10)";

const OPTIONS = [
  "Asian",
  "African",
  "Caucasian",
  "Hispanic / Latino",
  "Middle Eastern",
  "Mixed / Other",
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
    <ImageBackground
      source={require("../../assets/bg/score-bg.jpg")}
      resizeMode="cover"
      style={styles.screen}
      imageStyle={styles.bgImage}
    >
      <View style={styles.centerWrap}>
        <BlurView intensity={50} tint="dark" style={styles.card}>
          <View style={styles.cardOverlay} />

          {/* progress pill (step 2/3) */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(2 / 3) * 100}%` }]} />
            </View>
          </View>

          <T style={styles.title}>What’s your ethnicity?</T>
          <T style={styles.sub}>
            This helps us calibrate analysis based on global population data.
          </T>

          <FlatList
            data={rows}
            scrollEnabled={false}
            keyExtractor={(it) => it.key}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const active = selected === item.label;
              return (
                <Pressable
                  onPress={() => setField("ethnicity", item.label)}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && { transform: [{ translateY: 1 }] },
                  ]}
                >
                  {/* faint inner bevel */}
                  <View style={styles.optionInner} />
                  {/* active outer ring — NO elevation/background to avoid black slab */}
                  {active ? <View style={styles.optionRing} /> : null}

                  <T style={[styles.optionText, active && styles.optionTextActive]}>
                    {item.label}
                  </T>
                </Pressable>
              );
            }}
          />

          {/* Primary "Next" */}
          <Pressable
            onPress={onNext}
            disabled={!selected}
            accessibilityState={{ disabled: !selected } as AccessibilityState}
            style={({ pressed }) => [
              styles.primaryBtn,
              !selected && styles.primaryBtnDisabled,
              pressed && { transform: [{ translateY: 1 }] },
            ]}
          >
            <T style={styles.primaryLabel}>Next</T>
          </Pressable>

          {/* Secondary "Skip" */}
          <Pressable
            onPress={() => router.push("/(onboarding)/gender")}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { transform: [{ translateY: 1 }] },
            ]}
          >
            <T style={styles.secondaryLabel}>Skip</T>
          </Pressable>
        </BlurView>
      </View>
    </ImageBackground>
  );
}

const R = 28;
const PILL_R = 999;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  bgImage: {
    transform: [{ translateY: 40 }],
  },
  centerWrap: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "92%",
    borderRadius: R,
    overflow: "hidden",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD_TINT,
    borderRadius: R,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  progressWrap: { alignItems: "center", marginTop: 18, marginBottom: 12 },
  progressTrack: {
    height: 16,
    width: "86%",
    borderRadius: PILL_R,
    backgroundColor: TRACK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
  },

  title: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: "center",
    color: TEXT,
    marginTop: 6,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: TEXT_DIM,
    marginTop: 8,
    paddingHorizontal: 8,
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
  },

  listContainer: {
    paddingTop: 12,
    alignItems: "center", // makes children honor width below
  },

  option: {
    position: "relative",
    width: "86%",                 // pulled in so rounded corners don’t touch card
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",          // clip any artifacts
  },
  optionInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TRACK_INNER,
  },
  optionRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    // iOS glow; Android avoids elevation to prevent black rectangle
    ...(Platform.OS === "ios"
      ? {
          shadowColor: ACCENT,
          shadowOpacity: 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        }
      : null),
  },
  optionActive: {
    backgroundColor: "rgba(143,163,30,0.10)",
    borderColor: ACCENT,
  },
  optionText: {
    fontSize: 18,
    color: TEXT,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  optionTextActive: {
    color: TEXT,
  },

  primaryBtn: {
    marginTop: 18,
    alignSelf: "center",
    width: "86%",                 // same inset as options
    backgroundColor: ACCENT,
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    backgroundColor: BUTTON_TRACK,
  },
  primaryLabel: {
    fontSize: 16,
    color: "#0D0E0D",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  secondaryBtn: {
    marginTop: 10,
    marginBottom: 12,
    alignSelf: "center",
    width: "86%",                 // same inset
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  secondaryLabel: {
    fontSize: 16,
    color: TEXT,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
});
