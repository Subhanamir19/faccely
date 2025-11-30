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
  Alert,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnalysisCard, { type SubmetricView } from "@/components/analysis/AnalysisCard";
import { useProtocolsStore } from "@/store/protocolsStore";


// Poppins wrapper
import Text from "@/components/ui/T";

// Stores / nav
import { useScores, getSubmetricVerdicts } from "../../store/scores";
// UI
import GlassBtn from "@/components/ui/GlassBtn";
import { useRouter } from "expo-router";


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
  eyes_symmetry: ["Shape", "Symmetry", "Canthal Tilt", "Color"],

  jawline: ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  cheekbones: ["Definition", "Face Fat", "Maxilla Development", "Bizygomatic Width"],
  nose_harmony: ["Nose Shape", "Straightness", "Nose Balance", "Nose Tip Type"],
  skin_quality: ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  facial_symmetry: ["Horizontal Alignment", "Vertical Balance", "Eye-Line Level", "Nose-Line Centering"],
  sexual_dimorphism: ["Face Power", "Hormone Balance", "Contour Strength", "Softness Level"],
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
  const { protocols, isLoading: pLoading, regenerateFromLastAnalysis } = useProtocolsStore();

  const insets = useSafeAreaInsets();

  const pagerRef = useRef<PagerView>(null);
  const [idx, setIdx] = useState(0);
  const nav = useRouter();


  const hasScores = !!scores;
  const hasAnyExplanation = React.useMemo(() => {
    if (!explanations) return false;
    return Object.values(explanations).some((lines) =>
      Array.isArray(lines) ? lines.some((line) => typeof line === "string" && line.trim().length > 0) : false
    );
  }, [explanations]);
  const showEmptyState = !hasScores || !hasAnyExplanation;

  const isFirst = idx === 0;
  const isLast = idx === ORDER.length - 1;

  function goTo(page: number) {
    pagerRef.current?.setPage(page);
  }

  async function handleProtocols() {
    try {
      if (protocols) {
        nav.push("/(tabs)/protocols");
        return;
      }

      await regenerateFromLastAnalysis();

      const { protocols: latest, error } = useProtocolsStore.getState();
      if (latest) {
        nav.push("/(tabs)/protocols");
        return;
      }

      if (error) {
        Alert.alert("Error", error);
      }
    } catch (e: any) {
      Alert.alert("Error", String(e?.message ?? e));
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
        {showEmptyState ? (
          <Text style={styles.emptyState}>
            Advanced insights are not available for this session. Please run a new scan and advanced analysis.
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
            const current = band(score) ? `Current: ${band(score)}` : undefined;

            const verdicts = getSubmetricVerdicts(explanations, metric);
            const cleanedVerdicts = verdicts.map((line) => {
              const trimmed = line?.trim();
              return trimmed && trimmed.length > 0 ? trimmed : undefined;
            });
            const hasVerdictCopy = cleanedVerdicts.some(Boolean);

            const titles = SUBMETRICS[metric];
            const submetrics: SubmetricView[] = titles.map((t, i) => ({
              title: t,
              verdict: hasVerdictCopy ? cleanedVerdicts[i] : undefined,
            }));

            return (
              <View key={metric} style={styles.page}>
                <View style={styles.cardWrap}>
                <AnalysisCard
                    metric={metric}
                    copy={{ title: LABELS[metric], currentLabel: current }}
                    submetrics={submetrics}
                  />
                  {!hasVerdictCopy && !explLoading && (explanations || explError) ? (
                    <Text style={styles.placeholderNote}>
                      Detailed insights aren't available for this metric right now. Please try the
                      analysis again in a bit.
                    </Text>
                  ) : null}

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
            <View style={{ flex: 1, gap: PILL_ROW_GAP }}>
              <GlassBtn
                label={pLoading ? "Loading" : "Protocols"}
                icon="sparkles"
                onPress={handleProtocols}
                disabled={pLoading}
              />
            </View>

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
  emptyState: {
    color: "#FFEEAA",
    textAlign: "center",
    marginTop: 12,
    marginHorizontal: 24,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
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

  placeholderNote: {
    marginTop: 12,
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
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
