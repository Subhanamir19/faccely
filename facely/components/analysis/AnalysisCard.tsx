// facely/components/analysis/AnalysisCard.tsx
import React from "react";
import { View, Image, StyleSheet, TextStyle, useWindowDimensions } from "react-native";
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

// NEW: sub-metric view model (UI-only, optional)
export type SubmetricView = { title: string; verdict?: string };

const ACCENT = "#8FA31E";
const PAD = 16;
const MEDIA_H = 230; // visually matches score.tsx graph height (unused)

export default function AnalysisCard({
  metric,
  copy,
  submetrics, // if provided, shows the 2x2 grid
}: {
  metric: MetricKey;
  copy: AnalysisCopy;
  submetrics?: SubmetricView[];
}) {
  const { width } = useWindowDimensions();
  const mediaHeight = Math.max(190, Math.min(230, width * 0.55));
  const showGrid = Array.isArray(submetrics) && submetrics.length > 0;

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
        <View style={[styles.faceWrap, { height: mediaHeight }]}>
          <Image source={metricImage[metric]} resizeMode="contain" style={styles.face} />
          <LinearGradient
            colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.02)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {copy.currentLabel ? (
            <View style={styles.badge}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#101010" }}>
                {copy.currentLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Either render new 2x2 sub-metric grid, or fallback to old Strength/Improve copy */}
        {showGrid ? (
          <View style={styles.grid}>
            {submetrics!.slice(0, 4).map((s, i) => (
              <View key={`${s.title}-${i}`} style={styles.subCard}>
                <Text style={styles.subTitle}>{s.title}</Text>
                <Text style={styles.subVerdict} numberOfLines={2}>
                  {s.verdict || "--"}
                </Text>
                <View style={styles.subUnderline} />
              </View>
            ))}
          </View>
        ) : (
          <>
            {copy.strengthTitle ? (
              <Text style={tx.sectionHeading as TextStyle}>{copy.strengthTitle}</Text>
            ) : null}
            {copy.strengthText ? (
              <Text style={tx.bodyText as TextStyle}>{copy.strengthText}</Text>
            ) : null}

            {copy.improveTitle ? (
              <Text style={tx.sectionHeading as TextStyle}>{copy.improveTitle}</Text>
            ) : null}
            {copy.improveText ? (
              <Text style={tx.bodyText as TextStyle}>{copy.improveText}</Text>
            ) : null}
          </>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    paddingHorizontal: PAD,
    paddingTop: PAD,
    paddingBottom: PAD - 4,
    gap: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
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
    marginTop: 4,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

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

  // New grid styles
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 4,
    justifyContent: "space-between",
    rowGap: 12,
    paddingBottom: 4,
  },
  subCard: {
    width: "48%", // two per row
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  subTitle: {
    color: "#D7FF9E",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  subVerdict: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 20,
    minHeight: 20,
  },
  subUnderline: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 8,
    borderRadius: 2,
  },
});

const tx = StyleSheet.create({
  title: {
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
  current: {
    marginTop: 6,
    fontSize: 16,
    color: "#B8FF59",
  },
});
