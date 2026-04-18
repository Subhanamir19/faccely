// app/(onboarding)/score-projection.tsx
// Animated 90-day score projection — strokeDashoffset reveal, diverging curves.

import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

// ---------------------------------------------------------------------------
// Chart geometry
// ---------------------------------------------------------------------------

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48 - 40; // 24px screen pad each side + 20px card pad each side
const CHART_H = 190;

// Score scale: 44–84 over chart height
const SCORE_MIN = 44;
const SCORE_MAX = 84;
function sy(score: number): number {
  return CHART_H - ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * CHART_H;
}

const Y0  = sy(63);   // shared start        ≈ 86
const YA  = sy(77);   // sigma end (+14)      ≈ 27
const YB  = sy(55);   // no-routine end (−8)  ≈ 130
const W   = CHART_W;

// Sigma Max — slow start (adaptation), then accelerating climb
const PATH_SIGMA =
  `M 0,${Y0} ` +
  `C ${W * 0.14},${Y0} ${W * 0.28},${Y0 - 8} ${W * 0.44},${Y0 - 28} ` +
  `C ${W * 0.62},${Y0 - 54} ${W * 0.82},${YA + 6} ${W},${YA}`;

// No-routine — gradual drift down
const PATH_NOROUTINE =
  `M 0,${Y0} ` +
  `C ${W * 0.22},${Y0} ${W * 0.44},${Y0 + 8} ${W * 0.60},${YB - 14} ` +
  `C ${W * 0.76},${YB - 4} ${W * 0.90},${YB + 2} ${W},${YB}`;

// Area fill closed along chart bottom
const PATH_SIGMA_AREA =
  PATH_SIGMA + ` L ${W},${CHART_H} L 0,${CHART_H} Z`;

// Generous upper bound for dash length (actual arc ≈ 310–340 for W≈300)
const DASH_LEN = 500;

// ---------------------------------------------------------------------------
// Animated SVG components
// ---------------------------------------------------------------------------

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DEPTH = 4;
const FONT = Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }) as string;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ScoreProjectionScreen() {
  const insets = useSafeAreaInsets();
  const [dotsVisible, setDotsVisible] = useState(false);

  // Curve animation — strokeDashoffset from DASH_LEN → 0
  const sigmaOffset      = useSharedValue(DASH_LEN);
  const noRoutineOffset  = useSharedValue(DASH_LEN);
  const fillOp           = useSharedValue(0);

  useEffect(() => {
    const CURVE_DURATION = 1700;
    const EASE = Easing.inOut(Easing.cubic);

    // Both curves draw simultaneously after a short breath
    sigmaOffset.value = withDelay(380, withTiming(0, { duration: CURVE_DURATION, easing: EASE }));
    noRoutineOffset.value = withDelay(420, withTiming(0, { duration: CURVE_DURATION, easing: EASE }));

    // Area fill fades in as curves finish
    fillOp.value = withDelay(1600, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));

    // End dots appear after curves complete
    const t = setTimeout(() => setDotsVisible(true), 2100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sigmaProps      = useAnimatedProps(() => ({ strokeDashoffset: sigmaOffset.value }));
  const sigmaGlowProps  = useAnimatedProps(() => ({ strokeDashoffset: sigmaOffset.value }));
  const noRouteProps    = useAnimatedProps(() => ({ strokeDashoffset: noRoutineOffset.value }));
  const fillProps       = useAnimatedProps(() => ({ fillOpacity: fillOp.value }));

  const handleContinue = useCallback(() => {
    hapticSuccess();
    router.push("/(onboarding)/transformation");
  }, []);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.content, { paddingTop: insets.top + SP[8], paddingBottom: insets.bottom + SP[4] }]}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <Text style={styles.eyebrow}>SCORE PROJECTION</Text>
          <Text style={styles.headline}>{"Your Score\nin 90 Days"}</Text>
          <Text style={styles.subtext}>
            How users progress with vs. without a daily protocol
          </Text>
        </Animated.View>

        {/* ── Chart card ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.card}>

          <Svg width={CHART_W} height={CHART_H + 12}>
            <Defs>
              <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0"   stopColor={COLORS.accent} stopOpacity={0.18} />
                <Stop offset="1"   stopColor={COLORS.accent} stopOpacity={0}    />
              </SvgGradient>
            </Defs>

            {/* Subtle horizontal grid lines */}
            {[sy(55), sy(63), sy(71), sy(79)].map((y, i) => (
              <Path
                key={i}
                d={`M 0,${y} L ${W},${y}`}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
                strokeDasharray="4 8"
              />
            ))}

            {/* Area fill — fades in after curves finish */}
            <AnimatedPath
              d={PATH_SIGMA_AREA}
              fill="url(#areaFill)"
              animatedProps={fillProps}
            />

            {/* No-routine line */}
            <AnimatedPath
              d={PATH_NOROUTINE}
              stroke="rgba(255, 80, 80, 0.65)"
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={DASH_LEN}
              animatedProps={noRouteProps}
            />

            {/* Sigma Max glow (wide, soft halo — same animation) */}
            <AnimatedPath
              d={PATH_SIGMA}
              stroke={COLORS.accent}
              strokeWidth={14}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.12}
              strokeDasharray={DASH_LEN}
              animatedProps={sigmaGlowProps}
            />

            {/* Sigma Max line */}
            <AnimatedPath
              d={PATH_SIGMA}
              stroke={COLORS.accent}
              strokeWidth={4.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={DASH_LEN}
              animatedProps={sigmaProps}
            />

            {/* Start dot — shared origin */}
            <Circle cx={0} cy={Y0} r={4.5} fill="rgba(255,255,255,0.5)" />

            {/* End dots + labels — appear after draw */}
            {dotsVisible && (
              <>
                <Circle cx={W} cy={YA} r={5} fill={COLORS.accent} />
                <Circle cx={W} cy={YB} r={4} fill="rgba(255,80,80,0.7)" />
                <SvgText
                  x={W - 8}
                  y={YA - 10}
                  fontSize="12"
                  fontWeight="bold"
                  fill={COLORS.accent}
                  textAnchor="end"
                >
                  +14 pts
                </SvgText>
                <SvgText
                  x={W - 8}
                  y={YB + 16}
                  fontSize="11"
                  fill="rgba(255,100,100,0.85)"
                  textAnchor="end"
                >
                  no routine
                </SvgText>
              </>
            )}
          </Svg>

          {/* X-axis */}
          <View style={styles.xAxis}>
            {["Day 1", "Day 30", "Day 60", "Day 90"].map((l) => (
              <Text key={l} style={styles.axisLabel}>{l}</Text>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: COLORS.accent }]} />
              <Text style={styles.legendLabel}>With Sigma Max</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: "rgba(255,80,80,0.65)" }]} />
              <Text style={styles.legendLabel}>No routine</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Stat badge ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(360)} style={styles.statBadge}>
          <Text style={styles.statNumber}>+14 points</Text>
          <Text style={styles.statText}>
            avg score improvement for users completing{" "}
            <Text style={styles.statBold}>80%+</Text> of daily tasks
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── CTA ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(520)}>
          <View style={styles.btnDepth}>
            <Pressable
              onPress={handleContinue}
              onPressIn={() => hapticLight()}
              style={({ pressed }) => [
                styles.btnFace,
                { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
              ]}
            >
              <Text style={styles.btnText}>See My Plan</Text>
            </Pressable>
          </View>
        </Animated.View>

      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgTop },
  content: { flex: 1, paddingHorizontal: 24 },

  eyebrow: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.accent,
    marginBottom: SP[2],
  },
  headline: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 36,
    lineHeight: 42,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtext: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: COLORS.sub,
    marginTop: SP[2],
    marginBottom: SP[5],
    lineHeight: 20,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: RADII.lg,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  axisLabel: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.28)",
  },

  legend: {
    flexDirection: "row",
    gap: 20,
    marginTop: 14,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendLine: { width: 18, height: 2.5, borderRadius: 2 },
  legendLabel: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },

  statBadge: {
    marginTop: SP[4],
    backgroundColor: "rgba(180,243,77,0.07)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.13)",
    borderRadius: RADII.md,
    paddingVertical: SP[4],
    paddingHorizontal: SP[4],
    alignItems: "center",
  },
  statNumber: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 28,
    color: COLORS.accent,
    letterSpacing: -0.4,
  },
  statText: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.50)",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  statBold: {
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
  },

  btnDepth: {
    borderRadius: RADII.pill,
    backgroundColor: "#6B9A1E",
    paddingBottom: DEPTH,
  },
  btnFace: {
    height: 56,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: FONT,
    fontSize: 16,
    color: "#0B0B0B",
    letterSpacing: -0.1,
  },
});
