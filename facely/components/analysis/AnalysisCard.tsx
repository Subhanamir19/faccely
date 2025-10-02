import React from "react";
import { View, Image, StyleSheet, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Text from "@/components/ui/T";
import GlassCard from "@/components/ui/GlassCard";
import { metricImage } from "@/lib/metricImages";

type MetricKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism";

export type AnalysisCopy = {
  title: string;
  strengthTitle?: string;
  strengthText?: string;
  currentLabel?: string;
  improveTitle?: string;
  improveText?: string;
};

const ACCENT = "#8FA31E";
const PAD = 16;
const MEDIA_H = 230; // visually matches score.tsx graph height

export default function AnalysisCard({
  metric,
  copy,
}: {
  metric: MetricKey;
  copy: AnalysisCopy;
}) {
  return (
    <GlassCard>
      {/* Inner content uses the same horizontal rhythm as score.tsx */}
      <View style={styles.cardInner}>
        {/* Header row (title inside the card, like score.tsx) */}
        <View style={styles.headerRow}>
          <Text style={tx.title as TextStyle}>{copy.title}</Text>
          <View style={styles.infoPill}>
            <Text style={{ fontSize: 14, color: "#fff" }}>i</Text>
          </View>
        </View>

        {/* Face visualization with subtle dark overlay to match palette */}
        <View style={styles.faceWrap}>
          {/* contain => no cropping */}
          <Image source={metricImage[metric]} resizeMode="contain" style={styles.face} />
          <LinearGradient
            colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.02)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Current band badge sits inside media block to save vertical space */}
          {copy.currentLabel ? (
            <View style={styles.badge}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#101010" }}>
                {copy.currentLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Strength */}
        {copy.strengthTitle ? (
          <Text style={tx.sectionHeading as TextStyle}>{copy.strengthTitle}</Text>
        ) : null}
        {copy.strengthText ? (
          <Text style={tx.bodyText as TextStyle}>{copy.strengthText}</Text>
        ) : null}

        {/* Improve */}
        {copy.improveTitle ? (
          <Text style={tx.sectionHeading as TextStyle}>{copy.improveTitle}</Text>
        ) : null}
        {copy.improveText ? (
          <Text style={tx.bodyText as TextStyle}>{copy.improveText}</Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    paddingHorizontal: PAD,
    paddingTop: PAD,
    paddingBottom: PAD,
    gap: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
  },

  infoPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  faceWrap: {
    height: MEDIA_H,
    marginTop: 4,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  // keep full box, no cropping; contain respects image aspect
  face: { width: "100%", height: "100%", alignSelf: "center" },

  badge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
});

const tx = StyleSheet.create({
  title: {
    // Keep weight and palette, bring size closer to score.tsx header presence
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "#FFFFFF",
  },
  sectionHeading: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.92)",
  },
  // kept for compatibility if referenced elsewhere
  current: {
    marginTop: 6,
    fontSize: 16,
    color: "#B8FF59",
  },
});
