// app/(tabs)/dev.tsx
// DEV ONLY — preview onboarding flow without paywall/login.
// Remove this tab from _layout.tsx before shipping to production.
import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";

const SCREENS: { label: string; route: string }[] = [
  { label: "hook",            route: "/(onboarding)/hook" },
  { label: "intro",           route: "/(onboarding)/intro" },
  { label: "transformation",  route: "/(onboarding)/transformation" },
  { label: "use-case",        route: "/(onboarding)/use-case" },
  { label: "experience",      route: "/(onboarding)/experience" },
  { label: "age",             route: "/(onboarding)/age" },
  { label: "ethnicity",       route: "/(onboarding)/ethnicity" },
  { label: "gender",          route: "/(onboarding)/gender" },
  { label: "scan",            route: "/(onboarding)/scan" },
  { label: "trust",           route: "/(onboarding)/trust" },
  { label: "score-teaser",    route: "/(onboarding)/score-teaser" },
  { label: "goals",           route: "/(onboarding)/goals" },
  { label: "time-commitment", route: "/(onboarding)/time-commitment" },
  { label: "building-plan",  route: "/(onboarding)/building-plan" },
];

export default function DevScreen() {
  const insets = useSafeAreaInsets();
  const { resetForDevPreview, setDevPreview, devPreview } = useOnboarding();

  const startFullPreview = async () => {
    // Clears form data only — keeps completed=true so auth is unaffected
    await resetForDevPreview();
    setDevPreview(true);
    router.push("/(onboarding)/hook");
  };

  const jumpTo = (route: string) => {
    setDevPreview(true);
    router.push(route as any);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SP[6], paddingBottom: insets.bottom + SP[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <T variant="h3" color="text">🛠 Dev Preview</T>
        <T variant="caption" color="sub" style={{ marginTop: SP[1], marginBottom: SP[6] }}>
          Runs onboarding without paywall or login.{"\n"}Remove this tab before shipping.
        </T>

        {/* Status pill */}
        <View style={[styles.pill, { backgroundColor: devPreview ? "rgba(180,243,77,0.12)" : "rgba(255,255,255,0.06)" }]}>
          <View style={[styles.dot, { backgroundColor: devPreview ? COLORS.accent : "rgba(255,255,255,0.25)" }]} />
          <T variant="captionSemiBold" color={devPreview ? "accent" : "sub"}>
            devPreview {devPreview ? "ON" : "OFF"}
          </T>
        </View>

        {/* Primary CTA */}
        <Pressable
          onPress={startFullPreview}
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <T style={styles.primaryBtnText}>▶  Preview Full Flow</T>
          <T variant="caption" style={styles.primaryBtnSub}>Resets data → starts from hook</T>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <T variant="caption" color="sub" style={{ marginHorizontal: SP[3] }}>or jump to screen</T>
          <View style={styles.dividerLine} />
        </View>

        {/* Quick-jump list */}
        <View style={styles.jumpList}>
          {SCREENS.map((s, i) => (
            <Pressable
              key={s.route}
              onPress={() => jumpTo(s.route)}
              style={({ pressed }) => [
                styles.jumpRow,
                i < SCREENS.length - 1 && styles.jumpRowBorder,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <T variant="captionSemiBold" color="sub" style={styles.jumpIndex}>
                {String(i + 1).padStart(2, "0")}
              </T>
              <T variant="bodySemiBold" color="text">{s.label}</T>
              <T variant="caption" color="sub" style={styles.jumpArrow}>›</T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  scroll: {
    paddingHorizontal: SP[6],
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SP[2],
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RADII.circle,
    marginBottom: SP[5],
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADII.lg,
    paddingVertical: SP[4],
    paddingHorizontal: SP[5],
    marginBottom: SP[6],
  },
  primaryBtnText: {
    color: COLORS.bgTop,
    fontSize: 16,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
  },
  primaryBtnSub: {
    color: "rgba(0,0,0,0.5)",
    marginTop: SP[1],
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SP[4],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },

  jumpList: {
    borderRadius: RADII.card,
    overflow: "hidden",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  jumpRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingVertical: SP[4],
    gap: SP[3],
  },
  jumpRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  jumpIndex: {
    width: 24,
    opacity: 0.4,
    fontFamily: "Poppins-Regular",
  },
  jumpArrow: {
    marginLeft: "auto",
    fontSize: 18,
    lineHeight: 22,
  },
});
