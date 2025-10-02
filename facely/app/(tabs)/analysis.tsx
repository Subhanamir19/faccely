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

// Poppins wrapper
import Text from "@/components/ui/T";

// Stores / nav
import { useScores } from "../../store/scores";
import { useRecommendations } from "../../store/recommendations";
import { useRouter } from "expo-router";

// Card guts
import AnalysisCard, { AnalysisCopy } from "@/components/analysis/AnalysisCard";
import GlassBtn from "@/components/ui/GlassBtn";

const BG = require("../../assets/bg/score-bg.jpg");
const { width } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Tokens — mirror score.tsx spacing rhythm
// ---------------------------------------------------------------------------
const GUTTER = 16;                 // left/right screen padding (matches score)
const CARD_W = width - GUTTER * 2; // card width exactly like score.tsx
const PAGE_TOP = 10;               // top padding inside each pager page

const DOT_SIZE = 6;
const DOT_ACTIVE_W = 24;

const PILL_ROW_BOTTOM = 14;         // bottom offset of pill row (matches score)
const PILL_ROW_GAP = 12;           // space between pills
const DOTS_ABOVE_PILLS = 82;       // vertical distance of dots above bottom

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
  facial_symmetry: "Facial Symmetry",
  skin_quality: "Skin Quality",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eye Symmetry",
  nose_harmony: "Nose Harmony",
  sexual_dimorphism: "Sexual Dimorphism",
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

function defaultStrength(m: MetricKey) {
  switch (m) {
    case "eyes_symmetry": return "Your eyes are well aligned, contributing to balance.";
    case "jawline": return "Defined mandibular contour gives structure.";
    case "cheekbones": return "Zygomatic height adds lift and contrast.";
    case "nose_harmony": return "Nasal width and length fit overall proportions.";
    case "facial_symmetry": return "Left-right features are relatively balanced.";
    case "skin_quality": return "Texture and evenness support clarity.";
    case "sexual_dimorphism": return "Proportions lean toward stronger masculine cues.";
  }
}

function defaultImprove(m: MetricKey) {
  switch (m) {
    case "eyes_symmetry": return "Keep neutral head angle; eyebrow grooming can help.";
    case "jawline": return "Lower submental fat; posture and tongue posture improve definition.";
    case "cheekbones": return "Stay lean; even light from above emphasizes zygomatic contrast.";
    case "nose_harmony": return "Avoid harsh lighting; choose flattering focal length (50–85mm eq).";
    case "facial_symmetry": return "Shoot straight-on with even light; avoid lens distortion.";
    case "skin_quality": return "Routine: cleanse, moisturize, SPF; sleep and hydration.";
    case "sexual_dimorphism": return "Haircut shaping, brow clean-up, jaw posture for structure.";
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function AnalysisScreen() {
  const { scores, explanations, explLoading, explError } = useScores() as any;
  const { get } = useRecommendations();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const pagerRef = useRef<PagerView>(null);
  const [idx, setIdx] = useState(0);

  const isFirst = idx === 0;
  const isLast = idx === ORDER.length - 1;

  function goTo(page: number) {
    pagerRef.current?.setPage(page);
  }

  async function handleRecommendations() {
    if (!scores) return;
    const req = {
      age: 24,
      gender: undefined,
      ethnicity: undefined,
      metrics: ORDER.map((k) => ({
        key: k,
        score: Math.round(scores[k] ?? 0),
      })),
    };
    await get(req);
    router.push("/(tabs)/recommendations");
  }

  return (
    <ImageBackground source={BG} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView
        style={{
          flex: 1,
          paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0,
        }}
      >
        {/* loader/errors row */}
        {explLoading ? (
          <View style={styles.rowCenter}>
            <ActivityIndicator />
            <Text style={{ color: "rgba(255,255,255,0.7)", marginLeft: 8 }}>Analyzing…</Text>
          </View>
        ) : null}
        {explError ? (
          <Text style={{ color: "#FF6B6B", textAlign: "center", marginTop: 8 }}>
            {String(explError)}
          </Text>
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
            const lines = ((explanations?.[metric] ?? []) as string[]) || [];
            const copy: AnalysisCopy = {
              title: LABELS[metric],
              strengthTitle: "Strength",
              strengthText: lines[0] || defaultStrength(metric),
              currentLabel: band(score) ? `Current: ${band(score)}` : undefined,
              improveTitle: "Improve",
              improveText: lines[1] || defaultImprove(metric),
            };
            return (
              <View key={metric} style={styles.page}>
                <View style={styles.cardWrap}>
                  <AnalysisCard metric={metric} copy={copy} />
                </View>
              </View>
            );
          })}
        </PagerView>

        {/* Dots: anchored just above the buttons, same spacing rhythm as score */}
        <View
          style={[
            styles.dots,
            { bottom: insets.bottom + DOTS_ABOVE_PILLS },
          ]}
        >
          {ORDER.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>

        {/* Bottom glass button row — exact placement like score.tsx */}
        <View
          style={[
            styles.bottomBar,
            { left: GUTTER, right: GUTTER, bottom: PILL_ROW_BOTTOM + insets.bottom },
          ]}
        >
          {/* Left pill: always Previous */}
<GlassBtn
  label="Previous"
  icon="chevron-back"
  onPress={() => !isFirst && goTo(idx - 1)}
  disabled={isFirst}
/>

{/* Right pill: Next normally; Recommendations on last card */}
{!isLast ? (
  <GlassBtn
    label="Next"
    icon="chevron-forward"
    onPress={() => goTo(idx + 1)}
  />
) : (
  <GlassBtn
    label="Recommendations"
    icon="sparkles"
    onPress={handleRecommendations}
  />
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

  // Pager page container: mirrors score.tsx gutters and top offset
 // Pager page container: fully center the card
page: {
  flex: 1,
  justifyContent: "center",   // vertical centering
  alignItems: "center",       // horizontal centering
  paddingHorizontal: GUTTER,  // keep same side gutters
},


  // Card wrapper: exact same width and centering as score card
  cardWrap: {
    width: CARD_W,
    alignSelf: "center",
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
