// app/(tabs)/analysis.tsx
import React, { useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useScores } from "../../store/scores";
import MetricInsightCard from "../../components/MetricInsightCard";

const C = {
  bg: "#F7EEE9",
  text: "#0E1111",
  textDim: "rgba(14,17,17,0.65)",
};

type MetricKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism"
  | "youthfulness";

const ORDER: MetricKey[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
  "youthfulness",
];

const LABELS: Record<MetricKey, string> = {
  jawline: "Jawline",
  facial_symmetry: "Facial symmetry",
  skin_quality: "Skin quality",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eyes symmetry",
  nose_harmony: "Nose harmony",
  sexual_dimorphism: "Sexual dimorphism",
  youthfulness: "Youthfulness",
};

export default function AnalysisScreen() {
  const { imageUri, scores, explanations, explLoading, explError } = useScores();

  const items = useMemo(() => {
    return ORDER.map((k) => {
      const score = typeof scores?.[k] === "number" ? (scores![k] as number) : 0;
      const lines = (explanations?.[k] ?? []) as string[];
      const l1 = lines[0] || "No notes yet.";
      const l2 = lines[1] || "";
      return {
        key: k,
        title: LABELS[k],
        score,
        line1: l1,
        line2: l2,
        overlayUri: null, // put your annotated-per-metric image here
      };
    });
  }, [scores, explanations]);

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0 },
      ]}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingTop: 8, paddingBottom: 6 }}>
          <Text style={styles.headerTitle}>Advanced analysis</Text>
          <Text style={styles.headerSubtitle}>why each metric scored the way it did</Text>
        </View>

        {imageUri && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", aspectRatio: 3 / 4, backgroundColor: "#000" }}
              resizeMode="cover"
            />
          </View>
        )}

        {!!explLoading && (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <ActivityIndicator />
            <Text style={{ color: C.textDim }}>Analyzing…</Text>
          </View>
        )}
        {!!explError && (
          <Text style={{ textAlign: "center", color: "#C0392B", marginTop: 8 }}>
            {String(explError)}
          </Text>
        )}

        {items.map((it) => (
          <MetricInsightCard
            key={it.key}
            title={it.title}
            score={it.score}
            line1={it.line1}
            line2={it.line2}
            overlayUri={it.overlayUri}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerTitle: { textAlign: "center", color: C.text, fontSize: 22, fontWeight: "900" },
  headerSubtitle: { textAlign: "center", color: C.textDim, fontSize: 13, fontWeight: "700" },
});
