// app/(tabs)/analysis.tsx
import React, { useRef, useState } from "react";
import {
  View,
  ImageBackground,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import PagerView from "react-native-pager-view";
import AnalysisCard, { type SubmetricView } from "@/components/analysis/AnalysisCard";
import { useProtocolsStore } from "@/store/protocolsStore";
import Screen from "@/components/layout/Screen";
import MetricCardShell from "@/components/layout/MetricCardShell";
import MetricPagerFooter from "@/components/layout/MetricPagerFooter";
import { COLORS, SP } from "@/lib/tokens";
import useMetricSizing from "@/components/layout/useMetricSizing.ts";


// Poppins wrapper
import Text from "@/components/ui/T";

// Stores / nav
import { useScores, getSubmetricVerdicts } from "../../store/scores";
// UI
import { useRouter } from "expo-router";


const BG = require("../../assets/bg/score-bg.jpg");

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
  const { isLoading: pLoading, regenerateFromLastAnalysis } = useProtocolsStore();
  const sizing = useMetricSizing();

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
      await regenerateFromLastAnalysis();
      const { protocols: latest, error } = useProtocolsStore.getState();
      if (latest) {
        nav.push("/(tabs)/protocols");
      } else if (error) {
        Alert.alert("Error", error);
      } else {
        Alert.alert("Error", "Couldn't generate protocols.");
      }
    } catch (_err) {
      Alert.alert("Error", "Couldn't generate protocols.");
    }
  }
  
  

  return (
    <Screen
      scroll={false}
      contentContainerStyle={styles.screenContent}
      footer={
        <MetricPagerFooter
          index={idx}
          total={ORDER.length}
          onPrev={() => {
            if (!isFirst) goTo(idx - 1);
          }}
          onNext={() => (isLast ? handleProtocols() : goTo(idx + 1))}
          isFirst={isFirst}
          isLast={isLast}
          nextLabel={isLast ? "Protocols" : "Next"}
          nextDisabled={pLoading}
          padX={0}
        />
      }
    >
      <ImageBackground source={BG} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.scrim} />
      </ImageBackground>

      {/* loader/errors row */}
      {explLoading ? (
        <View style={styles.rowCenter}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Analyzing...</Text>
        </View>
      ) : null}
      {explError ? <Text style={styles.errorText}>{String(explError)}</Text> : null}
      {showEmptyState ? (
        <Text style={styles.emptyState}>
          Advanced insights are not available for this session. Please run a new scan and advanced analysis.
        </Text>
      ) : null}

      {/* Swipeable cards */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
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
              <MetricCardShell renderSurface={false} sizing={sizing}>
                {() => (
                  <>
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
                  </>
                )}
              </MetricCardShell>
            </View>
          );
        })}
      </PagerView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingTop: SP[4],
    paddingBottom: SP[4],
  },
  pager: {
    flex: 1,
  },
  rowCenter: {
    marginTop: SP[2],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    marginLeft: SP[2],
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  emptyState: {
    color: "#FFEEAA",
    textAlign: "center",
    marginTop: SP[3],
    marginHorizontal: SP[6],
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
    width: "100%",
  },

  placeholderNote: {
    marginTop: SP[3],
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  errorText: {
    color: "#FF6B6B",
    textAlign: "center",
    marginTop: SP[2],
  },
});
