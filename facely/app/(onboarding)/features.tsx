// app/(onboarding)/features.tsx
// "Here's what the app does for you" screen — 3 gradient-washed cards, each
// with a tilted phone mockup + side result chip + footer (icon, title, desc).
// Sits between score-projection and transformation.
import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  Image,
  ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronLeft,
  Target,
  Crosshair,
  CalendarCheck,
  Sparkles,
  LucideIcon,
} from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  FadeInDown,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import LimeButton from "@/components/ui/LimeButton";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

const STEP_KEY = "features";

type ChipRow = { dot: "filled" | "hollow" | "none"; text: string };

type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  image: ImageSourcePropType;
  accent: string;
  gradFrom: string;     // gradient start (top-left), tinted accent
  gradTo: string;       // gradient end (bottom-right), near-black
  border: string;
  badgeBg: string;
  tilt: string;         // phone rotation
  chipLabel: string;    // tiny all-caps label
  chipHeadline?: string;     // big payload
  chipHeadlineSub?: string;  // small meta under headline
  chipRows?: ChipRow[];      // checklist rows (alternative to headline)
};

const FEATURES: Feature[] = [
  {
    icon: Target,
    title: "Get an accurate score",
    desc: "A real rating of your looks. No flattery, no guesswork.",
    image: require("@/assets/onbaording-images/scoring.png"),
    accent: COLORS.accent,
    gradFrom: "rgba(180,243,77,0.22)",
    gradTo: "rgba(180,243,77,0.02)",
    border: "rgba(180,243,77,0.24)",
    badgeBg: "rgba(180,243,77,0.18)",
    tilt: "-5deg",
    chipLabel: "YOUR SCORE",
    chipHeadline: "77 / 100",
    chipHeadlineSub: "Strong · 8 metrics",
  },
  {
    icon: Crosshair,
    title: "Know your weakest points",
    desc: "See exactly what's holding your score back.",
    image: require("@/assets/onbaording-images/weakest-points.png"),
    accent: "#F5A524",
    gradFrom: "rgba(245,165,36,0.22)",
    gradTo: "rgba(245,165,36,0.02)",
    border: "rgba(245,165,36,0.24)",
    badgeBg: "rgba(245,165,36,0.18)",
    tilt: "4deg",
    chipLabel: "NEEDS WORK",
    chipRows: [
      { dot: "filled", text: "Cheekbones" },
      { dot: "filled", text: "Jaw development" },
      { dot: "hollow", text: "3 more areas" },
    ],
  },
  {
    icon: CalendarCheck,
    title: "Get a daily routine",
    desc: "Simple habits, built around your weak points.",
    image: require("@/assets/onbaording-images/routine.png"),
    accent: "#60A5FA",
    gradFrom: "rgba(96,165,250,0.22)",
    gradTo: "rgba(96,165,250,0.02)",
    border: "rgba(96,165,250,0.24)",
    badgeBg: "rgba(96,165,250,0.20)",
    tilt: "-5deg",
    chipLabel: "TODAY'S PLAN",
    chipRows: [
      { dot: "filled", text: "Neck curls" },
      { dot: "filled", text: "Chin tucks" },
      { dot: "hollow", text: "Maxilla pushing" },
    ],
  },
];

export default function FeaturesScreen() {
  const insets = useSafeAreaInsets();
  const progress = getProgressForStep(STEP_KEY);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const handleContinue = useCallback(() => {
    hapticSuccess();
    router.push("/(onboarding)/transformation");
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topRow, { paddingTop: insets.top + SP[2] }]}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={20} color={COLORS.text} strokeWidth={2.5} />
        </Pressable>
        <ProgressBar progress={progress} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pillWrap}>
          <View style={styles.pill}>
            <T variant="smallSemiBold" color="accent">
              Here's the plan
            </T>
          </View>
        </View>

        <T style={styles.headline}>
          {"You don't just get a\nscore, you get a map ⚡"}
        </T>

        <T variant="body" color="sub" style={styles.subhead}>
          Three things the app does for you.
        </T>

        <View style={styles.cards}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </View>

        <T variant="caption" color="sub" style={styles.closingLine}>
          Everything adapts as your score improves.
        </T>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}>
        <LimeButton label="Continue" onPress={handleContinue} />
      </View>
    </View>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(120 + index * 90)}
      style={[styles.card, { borderColor: feature.border }]}
    >
      <LinearGradient
        colors={[feature.gradFrom, feature.gradTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardTop}>
        <View style={[styles.phoneWrap, { transform: [{ rotate: feature.tilt }] }]}>
          <Image
            source={feature.image}
            style={styles.phoneImage}
            resizeMode="contain"
          />
        </View>

        <ResultChip feature={feature} />
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.iconBadge, { backgroundColor: feature.badgeBg }]}>
          <Icon size={22} color={feature.accent} strokeWidth={2.2} />
        </View>
        <View style={styles.cardText}>
          <T variant="h4" color="text" style={styles.cardTitle}>
            {feature.title}
          </T>
          <T variant="caption" color="sub">
            {feature.desc}
          </T>
        </View>
      </View>
    </Animated.View>
  );
}

function ResultChip({ feature }: { feature: Feature }) {
  return (
    <View style={[styles.chip, { borderColor: feature.border }]}>
      <View style={styles.chipLabelRow}>
        <Sparkles size={10} color={feature.accent} strokeWidth={2.5} />
        <T style={[styles.chipLabel, { color: feature.accent }]}>
          {feature.chipLabel}
        </T>
      </View>

      {feature.chipHeadline && (
        <>
          <T style={styles.chipHeadline}>{feature.chipHeadline}</T>
          {feature.chipHeadlineSub && (
            <T style={styles.chipSub}>{feature.chipHeadlineSub}</T>
          )}
        </>
      )}

      {feature.chipRows && (
        <View style={styles.chipRows}>
          {feature.chipRows.map((r, i) => (
            <View key={i} style={styles.chipRow}>
              <Dot variant={r.dot} color={feature.accent} />
              <T
                style={[
                  styles.chipRowText,
                  r.dot === "hollow" && { color: COLORS.sub },
                ]}
                numberOfLines={1}
              >
                {r.text}
              </T>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Dot({ variant, color }: { variant: ChipRow["dot"]; color: string }) {
  if (variant === "none") return <View style={{ width: 10 }} />;
  if (variant === "hollow") {
    return (
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: COLORS.sub,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
      }}
    />
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(0);
  React.useEffect(() => {
    width.value = withTiming(progress * 100, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

const BACK_SIZE = 40;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgTop },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[5],
    paddingBottom: SP[3],
  },
  backBtn: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.text,
    borderRadius: RADII.circle,
  },

  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    flexGrow: 1,
  },

  pillWrap: { alignItems: "center", marginBottom: SP[4] },
  pill: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.circle,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },

  headline: {
    textAlign: "center",
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: SP[3],
  },
  subhead: {
    textAlign: "center",
    marginBottom: SP[6],
  },

  cards: { gap: SP[4] },

  card: {
    borderRadius: RADII.card,
    borderWidth: 1,
    paddingTop: SP[5],
    paddingBottom: SP[5],
    paddingHorizontal: SP[4],
    overflow: "hidden",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[5],
  },
  phoneWrap: {
    width: 150,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneImage: { width: "100%", height: "100%" },

  chip: {
    flex: 1,
    borderRadius: RADII.lg,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingVertical: SP[3],
    paddingHorizontal: SP[3],
    gap: SP[1],
  },
  chipLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SP[1],
  },
  chipLabel: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1.2,
  },
  chipHeadline: {
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  chipSub: {
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  chipRows: { gap: SP[2], marginTop: SP[1] },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  chipRowText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: "Poppins-Medium",
    fontSize: 13,
    lineHeight: 18,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: RADII.circle,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { marginBottom: 2 },

  closingLine: {
    textAlign: "center",
    marginTop: SP[6],
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    backgroundColor: COLORS.bgTop,
  },
});
