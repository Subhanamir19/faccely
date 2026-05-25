import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { getScoreColor } from "./MetricGridCard";

const FONT = "ProximaNova-Bold";
const TILE_ICON_SIZE = ms(72);
const SHEET_ICON_SIZE = ms(76);
const ICON_SCALE: Record<AttractivenessPillarKey, number> = {
  angularity: 1,
  harmony: 0.88,
  dimorphism: 1,
  skin: 1,
};

const PILLAR_ACCENTS: Record<
  AttractivenessPillarKey,
  { color: string; bg: string; icon: ImageSourcePropType }
> = {
  angularity: {
    color: "#2563EB",
    bg: "#E0EAFF",
    icon: require("@/assets/attractiveness-icons/angularity.png"),
  },
  harmony: {
    color: "#3F7A2A",
    bg: "#E2F1D8",
    icon: require("@/assets/attractiveness-icons/harmony.png"),
  },
  dimorphism: {
    color: "#8B5CF6",
    bg: "#EFE7FF",
    icon: require("@/assets/attractiveness-icons/dimorphism.png"),
  },
  skin: {
    color: "#B5891A",
    bg: "#FBE9C2",
    icon: require("@/assets/attractiveness-icons/skin-quality.png"),
  },
} as const;

export type AttractivenessPillarKey =
  | "angularity"
  | "harmony"
  | "dimorphism"
  | "skin";

export type AttractivenessPillar = {
  key: AttractivenessPillarKey;
  label: string;
  score: number;
  summary: string;
  drivers: string[];
};

type Props = {
  overallScore?: number;
  overallLabel?: string;
  pillars: AttractivenessPillar[];
  opportunityLabel?: string;
  opportunityText?: string;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusForScore(score: number) {
  if (score >= 82) return "Sharp";
  if (score >= 72) return "Balanced";
  if (score >= 62) return "Emerging";
  return "Needs polish";
}

function darkenHex(hex: string, amount = 0.82) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(normalized.slice(0, 2), 16) * amount));
  const g = Math.max(0, Math.round(parseInt(normalized.slice(2, 4), 16) * amount));
  const b = Math.max(0, Math.round(parseInt(normalized.slice(4, 6), 16) * amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function SegmentedMeter({ score }: { score: number }) {
  const clamped = clampScore(score);
  const totalCells = 15;
  const activeCount = Math.max(1, Math.min(totalCells, Math.round((clamped / 100) * totalCells)));
  const color = getScoreColor(clamped);
  const segments = useMemo(() => Array.from({ length: activeCount }, (_, i) => i), [activeCount]);
  const anims = useRef(Array.from({ length: totalCells }, () => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach((anim) => anim.setValue(0));
    const sequence = segments.map((segment) =>
      Animated.timing(anims[segment], {
        toValue: 1,
        duration: 520,
        delay: segment * 82,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    Animated.parallel(sequence).start();
  }, [anims, segments]);

  return (
    <View style={styles.segmentTrack}>
      <View style={[styles.segmentFillRow, { width: `${clamped}%` }]}>
        {segments.map((segment) => {
          return (
            <Animated.View
              key={segment}
              style={[
                styles.segmentFill,
                {
                  backgroundColor: color,
                  opacity: anims[segment],
                  transform: [
                    {
                      scaleY: anims[segment].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.72, 1],
                      }),
                    },
                    {
                      scaleX: anims[segment].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 1],
                      }),
                    },
                    {
                      translateY: anims[segment].interpolate({
                        inputRange: [0, 1],
                        outputRange: [sh(3), 0],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function MetricTile({
  pillar,
  onPress,
}: {
  pillar: AttractivenessPillar;
  onPress: () => void;
}) {
  const accent = PILLAR_ACCENTS[pillar.key];
  const score = clampScore(pillar.score);
  const scoreColor = darkenHex(getScoreColor(score));
  const iconSize = TILE_ICON_SIZE * ICON_SCALE[pillar.key];
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);
  const scoreReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setDisplayScore(0);
    countAnim.setValue(0);
    scoreReveal.setValue(0);
    const id = countAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    const revealAnim = Animated.timing(scoreReveal, {
      toValue: 1,
      duration: 260,
      delay: 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const count = Animated.timing(countAnim, {
      toValue: score,
      duration: 1500,
      delay: 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    Animated.parallel([revealAnim, count]).start();

    return () => {
      revealAnim.stop();
      count.stop();
      countAnim.removeListener(id);
    };
  }, [countAnim, score, scoreReveal]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pillar.label}, ${score}, ${statusForScore(score)}. Tap for explanation.`}
      style={({ pressed }) => [
        styles.metricTile,
        pressed && { opacity: 0.86, transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={styles.iconWrap}>
        <Image
          source={accent.icon}
          style={[styles.metricIcon, { width: iconSize, height: iconSize }]}
          resizeMode="contain"
        />
      </View>

      <T style={styles.label} numberOfLines={2}>
        {pillar.label}
      </T>

      <View style={styles.resultRow}>
        <Animated.View
          style={{
            opacity: scoreReveal,
            transform: [
              {
                translateY: scoreReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sh(4), 0],
                }),
              },
              {
                scale: scoreReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <T style={[styles.score, { color: scoreColor }]}>{displayScore}</T>
        </Animated.View>
      </View>

      <SegmentedMeter score={score} />
    </Pressable>
  );
}

function ExplanationPopup({
  pillar,
  onClose,
}: {
  pillar: AttractivenessPillar | null;
  onClose: () => void;
}) {
  if (!pillar) return null;

  const accent = PILLAR_ACCENTS[pillar.key];
  const score = clampScore(pillar.score);
  const iconSize = SHEET_ICON_SIZE * ICON_SCALE[pillar.key];

  return (
    <Modal
      visible={!!pillar}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetIcon}>
              <Image
                source={accent.icon}
                style={[styles.sheetIconImage, { width: iconSize, height: iconSize }]}
                resizeMode="contain"
              />
            </View>
            <View style={styles.sheetTitleBlock}>
              <T style={styles.sheetTitle}>{pillar.label}</T>
              <T style={styles.sheetStatus}>{statusForScore(score)} metric</T>
            </View>
            <View style={[styles.sheetScore, { backgroundColor: accent.bg }]}>
              <T style={[styles.sheetScoreText, { color: accent.color }]}>{score}</T>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close explanation"
              style={styles.closeBtn}
            >
              <X size={ms(17)} color={COLORS.lightMuted} strokeWidth={2.6} />
            </Pressable>
          </View>

          <View style={styles.explanationBlock}>
            <T style={styles.blockLabel}>WHAT IT MEANS</T>
            <T style={styles.summary}>{pillar.summary}</T>
          </View>

          <View style={styles.explanationBlock}>
            <T style={styles.blockLabel}>SCORE DRIVERS</T>
            <View style={styles.driverRow}>
              {pillar.drivers.slice(0, 3).map((driver) => (
                <View key={driver} style={styles.driverChip}>
                  <T style={styles.driverText} numberOfLines={1}>
                    {driver}
                  </T>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AttractivenessOverviewCard({ pillars }: Props) {
  const [selected, setSelected] = useState<AttractivenessPillar | null>(null);
  const visiblePillars = pillars.slice(0, 4);

  return (
    <View style={styles.grid}>
      {visiblePillars.map((pillar) => (
        <MetricTile
          key={pillar.key}
          pillar={pillar}
          onPress={() => setSelected(pillar)}
        />
      ))}

      <ExplanationPopup
        pillar={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const TILE_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[3],
  },
  metricTile: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: sh(190),
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    padding: SP[4],
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
    ...TILE_SHADOW,
  },
  iconWrap: {
    width: ms(62),
    height: ms(62),
    borderRadius: ms(31),
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  metricIcon: {
    width: ms(72),
    height: ms(72),
  },
  score: {
    fontFamily: FONT,
    fontSize: ms(25),
    lineHeight: ms(28),
    letterSpacing: -0.6,
  },
  label: {
    fontFamily: FONT,
    fontSize: ms(14),
    lineHeight: ms(17),
    color: COLORS.lightText,
    letterSpacing: -0.15,
    textAlign: "center",
  },
  resultRow: {
    minHeight: sh(30),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: FONT,
    fontSize: ms(10),
    letterSpacing: 0.65,
  },
  segmentTrack: {
    alignSelf: "stretch",
    height: sh(22),
    borderRadius: RADII.sm,
    borderWidth: 2,
    borderColor: COLORS.lightMuted,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    paddingHorizontal: sw(7),
    justifyContent: "center",
  },
  segmentFillRow: {
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  segmentFill: {
    width: sw(7),
    height: sh(13),
    borderRadius: ms(2.5),
  },
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.lightBg,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[6],
    gap: SP[4],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  sheetIcon: {
    width: ms(66),
    height: ms(66),
    borderRadius: ms(33),
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sheetIconImage: {
    width: ms(76),
    height: ms(76),
  },
  sheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontFamily: FONT,
    fontSize: ms(21),
    lineHeight: ms(25),
    color: COLORS.lightText,
    letterSpacing: -0.35,
  },
  sheetStatus: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },
  sheetScore: {
    minWidth: sw(48),
    height: sh(40),
    borderRadius: RADII.circle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[3],
  },
  sheetScoreText: {
    fontFamily: FONT,
    fontSize: ms(18),
  },
  closeBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurface,
  },
  explanationBlock: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    padding: SP[4],
    gap: SP[2],
  },
  blockLabel: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: COLORS.lightSub,
    letterSpacing: 1.0,
  },
  summary: {
    fontFamily: FONT,
    fontSize: ms(14),
    lineHeight: ms(21),
    color: COLORS.lightMuted,
  },
  driverRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[2],
  },
  driverChip: {
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurface,
    paddingHorizontal: SP[3],
    paddingVertical: sh(7),
  },
  driverText: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightText,
    letterSpacing: 0.1,
  },
});
