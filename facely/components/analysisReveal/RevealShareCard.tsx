// components/analysisReveal/RevealShareCard.tsx
// The 9:16 poster at the end of the reveal. Framed as a glow-up plan, not a
// list of flaws: people share where they are going, not what is wrong.
// "Hide my face" swaps the photo for an outline, so anyone can post it.

import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { Circle } from "react-native-svg";

import T from "@/components/ui/T";
import FaceStage, { REVEAL_ORANGE, regionFor } from "@/components/analysisReveal/FaceStage";
import type { Highlight } from "@/lib/analysisHighlights";
import type { FaceGeometry } from "@/lib/faceLandmarks";

export const SHARE_CARD_W = 360;
export const SHARE_CARD_H = 640;
const PHOTO_H = 372;

const FONT_BOLD = "SFProRounded-Bold";
const FONT_SEMI = "SFProRounded-Semibold";

type Props = {
  uri: string;
  geometry: FaceGeometry;
  problems: Highlight[];
  hideFace: boolean;
};

const RevealShareCard = forwardRef<View, Props>(function RevealShareCard(
  { uri, geometry, problems, hideFace },
  ref,
) {
  const k = Math.max(SHARE_CARD_W / geometry.imageW, PHOTO_H / geometry.imageH);
  const frontProblems = problems.filter((p) => !p.sidePhoto);

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.photo}>
        <FaceStage
          uri={uri}
          geometry={geometry}
          width={SHARE_CARD_W}
          height={PHOTO_H}
          focus={null}
          playToken={0}
          hideFace={hideFace}
        >
          {frontProblems.map((p) => {
            const c = regionFor(p.shape, geometry).center;
            return (
              <React.Fragment key={p.id}>
                <Circle cx={c.x} cy={c.y} r={9 / k} fill={REVEAL_ORANGE} fillOpacity={0.28} />
                <Circle cx={c.x} cy={c.y} r={4 / k} fill={REVEAL_ORANGE} />
              </React.Fragment>
            );
          })}
        </FaceStage>
        <View style={styles.photoFade} />
        <T style={styles.brand}>SIGMAMAX</T>
      </View>

      <View style={styles.body}>
        <T style={styles.title}>My glow-up plan</T>
        <View style={styles.rows}>
          {problems.map((p) => (
            <View key={p.id} style={styles.row}>
              <T style={styles.rowLabel} numberOfLines={1}>
                {p.label}
              </T>
              <T style={styles.rowNow}>{p.score}</T>
              <T style={styles.rowArrow}>→</T>
              <T style={styles.rowPotential}>{p.potential}</T>
            </View>
          ))}
        </View>
        <T style={styles.footer}>Potential is an estimate · Scan yours with SigmaMax</T>
      </View>
    </View>
  );
});

export default RevealShareCard;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_W,
    height: SHARE_CARD_H,
    backgroundColor: "#0B0B0C",
    borderRadius: 28,
    overflow: "hidden",
  },
  photo: { width: SHARE_CARD_W, height: PHOTO_H },
  photoFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: "rgba(11,11,12,0.55)",
  },
  brand: {
    position: "absolute",
    top: 18,
    left: 20,
    fontFamily: FONT_BOLD,
    fontSize: 12,
    letterSpacing: 3,
    color: REVEAL_ORANGE,
  },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },
  title: { fontFamily: FONT_BOLD, fontSize: 26, lineHeight: 30, color: "#FFFFFF" },
  rows: { marginTop: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  rowLabel: { flex: 1, fontFamily: FONT_SEMI, fontSize: 15, color: "rgba(255,255,255,0.78)" },
  rowNow: { fontFamily: FONT_SEMI, fontSize: 15, color: "rgba(255,255,255,0.45)" },
  rowArrow: { fontFamily: FONT_SEMI, fontSize: 13, color: "rgba(255,255,255,0.35)" },
  rowPotential: { fontFamily: FONT_BOLD, fontSize: 18, color: REVEAL_ORANGE, minWidth: 26, textAlign: "right" },
  footer: {
    marginTop: "auto",
    fontFamily: FONT_SEMI,
    fontSize: 11,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.4)",
  },
});
