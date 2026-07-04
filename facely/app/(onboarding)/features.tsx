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
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  ORANGE_ONBOARDING,
} from "@/components/onboarding/OrangeOnboardingLayout";

const FONT_BOLD = ORANGE_ONBOARDING.font;
const LIME = ORANGE_ONBOARDING.orange;
const SAGE = ORANGE_ONBOARDING.orangeDark;
const SAGE_SOFT = ORANGE_ONBOARDING.orangeSoft;
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: ms(20),
  shadowOffset: { width: 0, height: ms(8) },
  elevation: 4,
} as const;

const STEP_KEY = "features";

type ChipRow = { dot: "filled" | "hollow" | "none"; text: string };

type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  image: ImageSourcePropType;
  accent: string;          // accent hue used for icon, chip border & label
  accentSoft: string;      // very soft tint, used for icon-badge bg
  tilt: string;            // phone rotation
  chipLabel: string;       // tiny all-caps label
  chipHeadline?: string;   // big payload
  chipHeadlineSub?: string;
  chipRows?: ChipRow[];
};

const FEATURES: Feature[] = [
  {
    icon: Target,
    title: "Get an accurate score",
    desc: "A real rating of your looks. No flattery, no guesswork.",
    image: require("@/assets/onbaording-images/scoring.png"),
    accent: SAGE,
    accentSoft: SAGE_SOFT,
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
    accent: ORANGE_ONBOARDING.orangeDark,
    accentSoft: ORANGE_ONBOARDING.orangeSoft,
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
    accent: ORANGE_ONBOARDING.orangeDark,
    accentSoft: ORANGE_ONBOARDING.orangeSoft,
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
    <OrangeOnboardingLayout
      showHeader={false}
      scrollable={false}
      footer={<OrangePrimaryButton label="Continue" onPress={handleContinue} />}
    >

      <View style={[styles.topRow, { paddingTop: insets.top + SP[2] }]}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <ChevronLeft size={ms(20)} color={COLORS.lightText} strokeWidth={2.5} />
        </Pressable>
        <ProgressBar progress={progress} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + sh(120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pillWrap}>
          <View style={styles.pill}>
            <T style={styles.pillText}>HERE'S THE PLAN</T>
          </View>
        </View>

        <T style={styles.headline}>
          {"You don't just get a\nscore, you get a map"}
        </T>

        <T style={styles.subhead}>
          Three things the app does for you.
        </T>

        <View style={styles.cards}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </View>

        <T style={styles.closingLine}>
          Everything adapts as your score improves.
        </T>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.cta,
            pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={styles.ctaText}>CONTINUE</T>
        </Pressable>
      </View>
    </OrangeOnboardingLayout>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(120 + index * 90)}
      style={styles.card}
    >
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
        <View style={[styles.iconBadge, { backgroundColor: feature.accentSoft }]}>
          <Icon size={ms(22)} color={feature.accent} strokeWidth={2.2} />
        </View>
        <View style={styles.cardText}>
          <T style={styles.cardTitle}>{feature.title}</T>
          <T style={styles.cardDesc}>{feature.desc}</T>
        </View>
      </View>
    </Animated.View>
  );
}

function ResultChip({ feature }: { feature: Feature }) {
  return (
    <View style={[styles.chip, { backgroundColor: feature.accentSoft }]}>
      <View style={styles.chipLabelRow}>
        <Sparkles size={ms(10)} color={feature.accent} strokeWidth={2.5} />
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
                  r.dot === "hollow" && { color: COLORS.lightSub },
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
          borderColor: COLORS.lightSub,
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },

  topRow: {
    display: "none",
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[5],
    paddingBottom: SP[3],
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: COLORS.lightSurfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
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

  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    flexGrow: 1,
  },

  pillWrap: { alignItems: "center", marginBottom: SP[4] },
  pill: {
    paddingHorizontal: SP[4],
    paddingVertical: sh(8),
    borderRadius: 999,
    backgroundColor: SAGE_SOFT,
  },
  pillText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(11),
    color: SAGE,
    letterSpacing: 1.2,
  },

  headline: {
    textAlign: "center",
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    letterSpacing: -0.5,
    marginBottom: SP[3],
  },
  subhead: {
    textAlign: "center",
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    marginBottom: SP[6],
  },

  cards: { gap: SP[4] },

  card: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    paddingTop: SP[5],
    paddingBottom: SP[5],
    paddingHorizontal: SP[4],
    overflow: "hidden",
    ...SOFT_SHADOW,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[5],
  },
  phoneWrap: {
    width: sw(140),
    height: sh(220),
    alignItems: "center",
    justifyContent: "center",
  },
  phoneImage: { width: "100%", height: "100%" },

  chip: {
    flex: 1,
    borderRadius: RADII.lg,
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
    fontSize: ms(10),
    fontFamily: FONT_BOLD,
    letterSpacing: 1.2,
  },
  chipHeadline: {
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(22),
    lineHeight: ms(26),
    letterSpacing: -0.3,
  },
  chipSub: {
    color: COLORS.lightSub,
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(12),
    lineHeight: ms(16),
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
    color: COLORS.lightText,
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(13),
    lineHeight: ms(18),
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  iconBadge: {
    width: ms(48),
    height: ms(48),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(16),
    color: COLORS.lightText,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(13),
    lineHeight: ms(18),
    color: COLORS.lightSub,
  },

  closingLine: {
    textAlign: "center",
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: SP[6],
  },

  footer: {
    display: "none",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    backgroundColor: COLORS.lightBg,
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
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
