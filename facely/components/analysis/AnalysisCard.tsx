// facely/components/analysis/AnalysisCard.tsx
import React from "react";
import { View, Image, StyleSheet, TextStyle, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Text from "@/components/ui/T";
import GlassCard from "@/components/ui/GlassCard";
import { metricImage } from "@/lib/metricImages";
import { sw, sh, ms, SCREEN_WIDTH, SCREEN_HEIGHT } from "@/lib/responsive";
import { getVerdictStyle } from "@/lib/verdictColor";

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

// ── Responsive values ────────────────────────────────────────────
const CARD_PAD = sw(14);
const MEDIA_H = Math.max(sh(170), Math.min(sh(230), SCREEN_WIDTH * 0.48));
const GRID_GAP = sh(8);
const SUB_PAD_H = sw(12);
const SUB_PAD_V = sh(10);
const SUB_RADIUS = ms(14);
const TITLE_FONT = ms(18, 0.3);
const SUB_TITLE_FONT = ms(13.5, 0.3);
const SUB_VERDICT_FONT = ms(12.5, 0.3);
const BADGE_FONT = ms(11, 0.3);
const BADGE_H = sh(24);
const INFO_PILL = ms(26);

const ACCENT = "#8FA31E";

export default function AnalysisCard({
  metric,
  copy,
  submetrics,
}: {
  metric: MetricKey;
  copy: AnalysisCopy;
  submetrics?: SubmetricView[];
}) {
  const showGrid = Array.isArray(submetrics) && submetrics.length > 0;

  return (
    <GlassCard>
      <View style={styles.cardInner}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={[tx.title, { fontSize: TITLE_FONT }] as TextStyle[]}>{copy.title}</Text>
          <View style={[styles.infoPill, { width: INFO_PILL, height: INFO_PILL, borderRadius: INFO_PILL / 2 }]}>
            <Text style={{ fontSize: ms(13), color: "#fff" }}>i</Text>
          </View>
        </View>

        {/* Face visualization */}
        <View style={[styles.faceWrap, { height: MEDIA_H }]}>
          <Image source={metricImage[metric]} resizeMode="contain" style={styles.face} />
          <LinearGradient
            colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.02)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {copy.currentLabel ? (
            <View style={[styles.badge, { height: BADGE_H, borderRadius: BADGE_H / 2 }]}>
              <Text style={{ fontSize: BADGE_FONT, fontWeight: "600", color: "#101010" }}>
                {copy.currentLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Sub-metric grid or fallback */}
        {showGrid ? (
          <View style={[styles.grid, { rowGap: GRID_GAP }]}>
            {submetrics!.slice(0, 4).map((s, i) => {
              const vs = getVerdictStyle(metric, i, s.verdict);
              return (
                <View key={`${s.title}-${i}`} style={[styles.subCard, { padding: SUB_PAD_V, paddingHorizontal: SUB_PAD_H, borderRadius: SUB_RADIUS }]}>
                  <Text style={[styles.subTitle, { fontSize: SUB_TITLE_FONT }]}>{s.title}</Text>
                  <Text
                    style={[
                      styles.subVerdict,
                      {
                        fontSize: SUB_VERDICT_FONT,
                        lineHeight: SUB_VERDICT_FONT * 1.45,
                        color: "rgba(255,255,255,0.92)",
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {s.verdict || "--"}
                  </Text>
                  {/* Tier accent underline */}
                  <View
                    style={[
                      styles.subUnderline,
                      { backgroundColor: vs.glow !== "transparent" ? vs.color : "rgba(255,255,255,0.12)" },
                      vs.glow !== "transparent" && { opacity: 0.35 },
                    ]}
                  />
                </View>
              );
            })}
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
    paddingHorizontal: CARD_PAD,
    paddingTop: CARD_PAD,
    paddingBottom: CARD_PAD - sh(3),
    gap: sh(8),
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: sh(6),
  },

  infoPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  faceWrap: {
    marginTop: sh(2),
    marginBottom: sh(6),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ms(14),
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  face: { width: "100%", height: "100%", alignSelf: "center" },

  badge: {
    position: "absolute",
    right: sw(8),
    bottom: sh(8),
    paddingHorizontal: sw(10),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: sh(2),
    justifyContent: "space-between",
    paddingBottom: sh(2),
  },
  subCard: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  subTitle: {
    color: "#D7FF9E",
    fontWeight: "700",
    marginBottom: sh(2),
  },
  subVerdict: {
    minHeight: sh(18),
  },
  subUnderline: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: sh(6),
    borderRadius: 2,
  },
});

const tx = StyleSheet.create({
  title: {
    fontSize: TITLE_FONT,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "#FFFFFF",
  },
  sectionHeading: {
    marginTop: sh(3),
    fontSize: ms(15),
    fontWeight: "700",
    color: ACCENT,
  },
  bodyText: {
    fontSize: ms(13),
    lineHeight: ms(19),
    color: "rgba(255,255,255,0.92)",
  },
  current: {
    marginTop: sh(4),
    fontSize: ms(15),
    color: "#B8FF59",
  },
});
