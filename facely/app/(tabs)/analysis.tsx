// app/(tabs)/analysis.tsx
import React, { useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  ImageBackground,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnalysisCard, { type SubmetricView } from "@/components/analysis/AnalysisCard";


// Poppins wrapper
import Text from "@/components/ui/T";

// Stores / nav
import { useScores, getSubmetricVerdicts } from "../../store/scores";
import { useRoutine } from "@/store/routine";
import { buildRoutineReq } from "@/lib/api/routine";
import { useRouter } from "expo-router";

// UI
import GlassBtn from "@/components/ui/GlassBtn";

const BG = require("../../assets/bg/score-bg.jpg");
const { width } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Tokens - mirror score.tsx spacing rhythm
// ---------------------------------------------------------------------------
const GUTTER = 16; // left/right screen padding (matches score)
const CARD_W = width - GUTTER * 2; // card width exactly like score.tsx
const PAGE_TOP = 10; // top padding inside each pager page

const DOT_SIZE = 6;
const DOT_ACTIVE_W = 24;

const PILL_ROW_BOTTOM = 14; // bottom offset of pill row (matches score)
const PILL_ROW_GAP = 12; // space between pills
const DOTS_ABOVE_PILLS = 82; // vertical distance of dots above bottom

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
type MetricKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism";

const ORDER: MetricKey[] = [
  "eyes_symmetry",
  "jawline",
  "cheekbones",
  "nose_harmony",
  "facial_symmetry",
  "skin_quality",
  "sexual_dimorphism",
];

const LABELS: Record<MetricKey, string> = {
  jawline: "Jawline",
  facial_symmetry: "Face Symmetry",
  skin_quality: "Skin",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eyes",
  nose_harmony: "Nose",
  sexual_dimorphism: "Masculinity",
};

// Sub-metric titles per feature (exactly what you mocked)
const SUBMETRICS: Record<MetricKey, [string, string, string, string]> = {
  eyes_symmetry: ["Symmetry", "Shape", "Canthal Tilt", "Color"],
  jawline: ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  cheekbones: ["Definition", "Face Fat", "Maxilla Development", "Bizygomatic Width"],
  nose_harmony: ["Nose Shape", "Straightness", "Nose Balance", "Nose Tip Type"],
  skin_quality: ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  facial_symmetry: ["Horizontal Alignment", "Vertical Balance", "Eye-Line Level", "Nose-Line Centering"],
  sexual_dimorphism: ["Face Power", "Hormone Balance", "Contour Strength", "Softness Level"],
};

// Optional default one-line verdicts so UI never looks empty.
// Replace these gradually with real per-submetric text from your explanations pipeline.
const DEFAULT_VERDICTS: Partial<Record<MetricKey, string[]>> = {
  eyes_symmetry: [
    "Left eyelid slightly higher",
    "Almond shape, ideal",
    "Neutral - a slight lift improves sharpness",
    "Clear and vibrant",
  ],
  jawline: [
    "Crisp and well-defined",
    "Balanced on both sides",
    "Ideal, around 120 deg",
    "Not recessed, well-pronounced",
  ],
  cheekbones: [
    "Sharp and angular",
    "Low, well-defined",
    "Developed, ideal",
    "Masculine, ideal",
  ],
  nose_harmony: ["Ideal", "Straight", "Well-proportioned", "Slightly bulbous"],
  skin_quality: ["No acne or blemishes", "Smooth and soft", "Even tone", "Youthful appearance"],
  facial_symmetry: ["Well-centered", "Upper-tilt left", "Aligned", "Centered"],
  sexual_dimorphism: ["Solid and defined", "Leans masculine", "Clear edges throughout", "Firm, minimal softness"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function band(score: number | undefined) {
  if (typeof score !== "number") return undefined;
  if (score >= 85) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 40) return "Average";
  return "Poor";
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function AnalysisScreen() {
  const { scores, explanations, explLoading, explError } = useScores();
  const prefetchRoutine = useRoutine((state) => state.prefetch);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const pagerRef = useRef<PagerView>(null);
  const [idx, setIdx] = useState(0);

  const isFirst = idx === 0;
  const isLast = idx === ORDER.length - 1;

  function goTo(page: number) {
    pagerRef.current?.setPage(page);
  }

  async function handleRoutine() {

    if (!scores) return;
    const mapped = ORDER.reduce<Record<string, number | undefined>>((acc, key) => {
      acc[key] = scores[key];
      return acc;
    }, {});
    const req = buildRoutineReq({
      age: 24,
      gender: undefined,
      ethnicity: undefined,
      scores: mapped,
    });
    try {
      await prefetchRoutine(req);
      router.push("/(tabs)/routine");
    } catch {
      /* swallow - store exposes error */
    }
  }

  return (
    <ImageBackground source={BG} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView
        style={{
          flex: 1,
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
        }}
      >
        {/* loader/errors row */}
        {explLoading ? (
          <View style={styles.rowCenter}>
            <ActivityIndicator />
            <Text style={{ color: "rgba(255,255,255,0.7)", marginLeft: 8 }}>Analyzing...</Text>
          </View>
        ) : null}
        {explError ? (
          <Text style={{ color: "#FF6B6B", textAlign: "center", marginTop: 8 }}>{String(explError)}</Text>
        ) : null}

        {/* Swipeable cards */}
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={(e) => setIdx(e.nativeEvent.position)}
        >
          {ORDER.map((metric) => {
            const score = scores?.[metric] as number | undefined;
            const current = band(score) ? `Current: ${band(score)}` : undefined;

            const verdicts = getSubmetricVerdicts(explanations, metric);
            const finalVerdicts =
              verdicts.some((line) => line && line.trim().length > 0)
                ? verdicts
                : DEFAULT_VERDICTS[metric] ?? ["", "", "", ""];

            const titles = SUBMETRICS[metric];
            const submetrics: SubmetricView[] = titles.map((t, i) => ({
              title: t,
              verdict: finalVerdicts[i],
            }));

            return (
              <View key={metric} style={styles.page}>
                <View style={styles.cardWrap}>
                <AnalysisCard
  metric={metric}
  copy={{ title: LABELS[metric], currentLabel: current }}
  submetrics={submetrics}
/>

                </View>
              </View>
            );
          })}
        </PagerView>

        {/* Dots: anchored just above the buttons */}
        <View style={[styles.dots, { bottom: insets.bottom + DOTS_ABOVE_PILLS }]}>
          {ORDER.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>

        {/* Bottom glass button row - exact placement like score.tsx */}
        <View
          style={[
            styles.bottomBar,
            { left: GUTTER, right: GUTTER, bottom: PILL_ROW_BOTTOM + insets.bottom },
          ]}
        >
          <GlassBtn
            label="Previous"
            icon="chevron-back"
            onPress={() => {
              if (!isFirst) {
                goTo(idx - 1);
              }
            }}
            disabled={isFirst}
          />
          {!isLast ? (
            <GlassBtn label="Next" icon="chevron-forward" onPress={() => goTo(idx + 1)} />
          ) : (
            <GlassBtn label="Routine" icon="sparkles" onPress={handleRoutine} />
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  rowCenter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // Pager page container: fully center the card
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: GUTTER,
    paddingTop: PAGE_TOP,
  },

  // Outer card container
  cardWrap: {
    width: CARD_W,
    alignSelf: "center",
  },

  // Card shell
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(8,9,10,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  cardTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: "white",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    fontWeight: "600",
  },

  portraitWrap: {
    height: 210,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  portraitShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  badge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "#B8FF59",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeText: {
    color: "#0B0C0D",
    fontWeight: "600",
  },

  // 2x2 grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 14,
    paddingBottom: 18,
  },

  // Dots
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  dotActive: {
    backgroundColor: "#B8FF59",
    width: DOT_ACTIVE_W,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  // Bottom bar exactly like score.tsx: absolute, two equal glass pills
  bottomBar: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: PILL_ROW_GAP,
  },
});
