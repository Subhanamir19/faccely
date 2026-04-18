// components/analysis/BlueprintModal.tsx
// Auto-surfaces after advanced analysis loads — shows user's top weak facial traits
// ranked by score. Slides up as a bottom sheet over the analysis screen.

import React, { useCallback, useEffect, useMemo } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/T";
import { COLORS } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";

// ─── Trait data ───────────────────────────────────────────────────────────────

type TraitItem = {
  id: string;
  label: string;
  score: number;
  descriptor: string;
  severityLabel: string;
  severityColor: string;
  severityDepthColor: string;
  severityTextColor: string;
  barColor: string;
};

const TRAIT_LABELS: Record<string, string> = {
  "jawline.projection":        "Chin Projection",
  "cheekbones.face_fat":       "Face Fat",
  "jawline.development":       "Jaw Development",
  "cheekbones.bone_structure": "Bone Structure",
  "cheekbones.maxilla":        "Maxilla",
  "cheekbones.width":          "Cheekbone Width",
  "eyes.canthal_tilt":         "Canthal Tilt",
  "eyes.symmetry":             "Eye Symmetry",
  "eyes.eye_type":             "Eye Shape",
  "eyes.brow_volume":          "Brow Volume",
  "jawline.gonial_angle":      "Gonial Angle",
  "skin.quality":              "Skin Quality",
  "skin.color":                "Skin Tone",
};

const TRAIT_DESC: Record<string, string> = {
  "jawline.projection":        "Chin is recessed — biggest structural gap in your lower face",
  "cheekbones.face_fat":       "Excess facial fat is blurring your underlying bone structure",
  "jawline.development":       "Jaw is underdeveloped — lower face lacks structural mass",
  "cheekbones.bone_structure": "Facial bone structure lacks definition and density",
  "cheekbones.maxilla":        "Maxilla development is limiting your midface projection",
  "cheekbones.width":          "Cheekbone width is narrower than ideal — face lacks lateral structure",
  "eyes.canthal_tilt":         "Canthal tilt is below ideal — eye framing needs improvement",
  "eyes.symmetry":             "Eye asymmetry detected — left-right orbital imbalance",
  "eyes.eye_type":             "Eye shape is below ideal — orbital area underdeveloped",
  "eyes.brow_volume":          "Brow volume is sparse — upper face lacks framing",
  "jawline.gonial_angle":      "Jaw angle is off ideal — affecting your lower face silhouette",
  "skin.quality":              "Skin texture is below average — surface quality needs work",
  "skin.color":                "Skin tone is uneven — complexion lacks consistency",
};

function resolveSeverity(score: number): { label: string; color: string; depthColor: string; textColor: string } {
  if (score < 40) return { label: "WEAK",      color: "#FF4F4F", depthColor: "#B83030", textColor: "#FFFFFF" };
  if (score < 55) return { label: "BELOW AVG", color: "#F07030", depthColor: "#A84E18", textColor: "#FFFFFF" };
  return                  { label: "MODERATE",  color: "#F0C000", depthColor: "#A07800", textColor: "#3A2800" };
}

function resolveBarColor(score: number): string {
  if (score < 40) return "#FF6B6B";
  if (score < 55) return "#F08C5A";
  return "#F5C842";
}

function computeTargets(data: AdvancedAnalysis): TraitItem[] {
  const raw = [
    { id: "jawline.projection",        score: data.jawline.projection_score        },
    { id: "cheekbones.face_fat",       score: data.cheekbones.face_fat_score       },
    { id: "jawline.development",       score: data.jawline.development_score       },
    { id: "cheekbones.bone_structure", score: data.cheekbones.bone_structure_score },
    { id: "cheekbones.maxilla",        score: data.cheekbones.maxilla_score        },
    { id: "cheekbones.width",          score: data.cheekbones.width_score          },
    { id: "eyes.canthal_tilt",         score: data.eyes.canthal_tilt_score         },
    { id: "eyes.symmetry",             score: data.eyes.symmetry_score             },
    { id: "eyes.eye_type",             score: data.eyes.eye_type_score             },
    { id: "eyes.brow_volume",          score: data.eyes.brow_volume_score          },
    { id: "jawline.gonial_angle",      score: data.jawline.gonial_angle_score      },
    { id: "skin.quality",              score: data.skin.quality_score              },
    { id: "skin.color",                score: data.skin.color_score                },
  ];

  const sorted = [...raw].sort((a, b) => a.score - b.score);
  const weak   = sorted.filter((e) => e.score < 70).slice(0, 5);
  const source = weak.length > 0 ? weak : sorted.slice(0, 3);

  return source.map((e) => {
    const sev = resolveSeverity(e.score);
    return {
      id:                 e.id,
      label:              TRAIT_LABELS[e.id] ?? e.id,
      score:              e.score,
      descriptor:         TRAIT_DESC[e.id]   ?? "Needs improvement",
      severityLabel:      sev.label,
      severityColor:      sev.color,
      severityDepthColor: sev.depthColor,
      severityTextColor:  sev.textColor,
      barColor:           resolveBarColor(e.score),
    };
  });
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, color, delay }: { score: number; color: string; delay: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(score, { duration: 650, easing: Easing.out(Easing.cubic) })
    );
  }, [score, delay]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` as any }));

  return (
    <View style={barSx.track}>
      <Animated.View style={[barSx.fill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const barSx = StyleSheet.create({
  track: {
    height:          sh(4),
    backgroundColor: "rgba(0,0,0,0.10)",
    borderRadius:    999,
    overflow:        "hidden",
    marginTop:       sh(7),
    marginBottom:    sh(5),
  },
  fill: {
    height:       "100%",
    borderRadius: 999,
  },
});

// ─── Trait icons ──────────────────────────────────────────────────────────────

const TRAIT_ICONS: Record<string, ReturnType<typeof require>> = {
  "jawline.projection":        require("../../advanced-analysis-icons/advanced-analysis-icons-new/chin--projection.jpeg"),
  "cheekbones.face_fat":       require("../../advanced-analysis-icons/advanced-analysis-icons-new/face--fat.jpeg"),
  "jawline.development":       require("../../advanced-analysis-icons/advanced-analysis-icons-new/jawline--development.jpeg"),
  "cheekbones.bone_structure": require("../../advanced-analysis-icons/advanced-analysis-icons-new/BONE-STRUCTURE.jpeg"),
  "cheekbones.maxilla":        require("../../advanced-analysis-icons/advanced-analysis-icons-new/maxilla--.jpeg"),
  "cheekbones.width":          require("../../advanced-analysis-icons/advanced-analysis-icons-new/cheekbones--width.jpeg"),
  "eyes.canthal_tilt":         require("../../advanced-analysis-icons/advanced-analysis-icons-new/canthal--tilt.jpeg"),
  "eyes.symmetry":             require("../../advanced-analysis-icons/advanced-analysis-icons-new/eyes--symmetry.jpeg"),
  "eyes.eye_type":             require("../../advanced-analysis-icons/advanced-analysis-icons-new/eye--type.jpeg"),
  "eyes.brow_volume":          require("../../advanced-analysis-icons/advanced-analysis-icons-new/eyebrows--densiy.jpeg"),
  "jawline.gonial_angle":      require("../../advanced-analysis-icons/advanced-analysis-icons-new/gonial--angle.jpeg"),
  "skin.quality":              require("../../advanced-analysis-icons/advanced-analysis-icons-new/skin--quality.jpeg"),
  "skin.color":                require("../../advanced-analysis-icons/advanced-analysis-icons-new/SKIN--COLOR.jpeg"),
};

// ─── Trait card ───────────────────────────────────────────────────────────────

const ICON_SIZE = ms(44);

function TraitCard({ item, rank, enterDelay }: { item: TraitItem; rank: number; enterDelay: number }) {
  const isTop = rank === 1;
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconSource = TRAIT_ICONS[item.id];

  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(enterDelay)}
      style={scaleStyle}
    >
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(1.025, { damping: 16, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1.0, { damping: 20, stiffness: 260 });
        }}
        style={[cardSx.card, isTop && cardSx.cardTop]}
      >
        {isTop && (
          <LinearGradient
            colors={["rgba(130,200,0,0.12)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}

        <View style={cardSx.row}>
          {/* Metric icon */}
          <View style={[cardSx.iconWrap, isTop && cardSx.iconWrapTop]}>
            {iconSource ? (
              <Image
                source={iconSource}
                style={cardSx.iconImg}
                resizeMode="cover"
              />
            ) : null}
          </View>

          {/* Body */}
          <View style={{ flex: 1 }}>
            <View style={cardSx.topRow}>
              <Text style={cardSx.label}>{item.label}</Text>
              <View style={[cardSx.sevDepth, { backgroundColor: item.severityDepthColor }]}>
                <View style={[cardSx.sevBtn, { backgroundColor: item.severityColor }]}>
                  <Text style={[cardSx.sevText, { color: item.severityTextColor }]}>
                    {item.severityLabel}
                  </Text>
                </View>
              </View>
            </View>

            <ScoreBar score={item.score} color={item.barColor} delay={enterDelay + 80} />

            <Text style={cardSx.descriptor}>{item.descriptor}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const cardSx = StyleSheet.create({
  card: {
    backgroundColor:   "#F4F4F4",
    borderRadius:      ms(16),
    borderWidth:       1,
    borderColor:       "rgba(0,0,0,0.06)",
    borderBottomWidth: 4,
    borderBottomColor: "#D8D8D8",
    paddingHorizontal: sw(14),
    paddingVertical:   sh(11),
    overflow:          "hidden",
  },
  cardTop: {
    borderColor:       "rgba(100,160,0,0.28)",
    borderBottomColor: "#C8C8C8",
  },
  row: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           sw(12),
  },
  iconWrap: {
    width:        ICON_SIZE,
    height:       ICON_SIZE,
    borderRadius: ms(10),
    overflow:     "hidden",
    flexShrink:   0,
    borderWidth:  1.5,
    borderColor:  "rgba(0,0,0,0.08)",
  },
  iconWrapTop: {
    borderColor: "rgba(100,160,0,0.30)",
  },
  iconImg: {
    width:  "100%",
    height: "100%",
  },
  topRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize:      ms(14, 0.3),
    fontFamily:    Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color:         "#111111",
    letterSpacing: -0.2,
  },
  // 3D severity button
  sevDepth: {
    borderRadius:  999,
    paddingBottom: sh(3),
  },
  sevBtn: {
    borderRadius:      999,
    paddingHorizontal: sw(8),
    paddingVertical:   sh(3),
    alignItems:        "center",
    justifyContent:    "center",
  },
  sevText: {
    fontSize:      ms(9, 0.3),
    fontFamily:    Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: 0.8,
  },
  descriptor: {
    fontSize:   ms(12, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color:      "#888888",
    lineHeight: ms(17),
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface BlueprintModalProps {
  data:      AdvancedAnalysis;
  imageUri:  string | null;
  visible:   boolean;
  onDismiss: () => void;
}

export function BlueprintModal({ data, imageUri, visible, onDismiss }: BlueprintModalProps) {
  const { height: screenH } = useWindowDimensions();
  const insets              = useSafeAreaInsets();
  const targets             = useMemo(() => computeTargets(data), [data]);

  // Sheet slide-up
  const translateY       = useSharedValue(screenH);
  const backdropOpacity  = useSharedValue(0);
  // Pulsing LIVE dot
  const pulseOpacity     = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      translateY.value      = withSpring(0, { damping: 22, stiffness: 180, overshootClamping: false });
      backdropOpacity.value = withTiming(1, { duration: 300 });
      pulseOpacity.value    = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 650, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      );
    } else {
      translateY.value      = withTiming(screenH, { duration: 290, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: 290 });
    }
  }, [visible]);

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const dotStyle      = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  const dismiss = useCallback(() => {
    translateY.value      = withTiming(screenH, { duration: 290, easing: Easing.in(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: 290 });
    setTimeout(onDismiss, 300);
  }, [onDismiss, screenH]);

  if (!visible) return null;

  const safeBottom = Math.max(insets.bottom, sh(16));

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="none"
      visible={visible}
      onRequestClose={dismiss}
    >
      {/* Backdrop — tap to dismiss */}
      <Animated.View style={[StyleSheet.absoluteFill, m.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[m.sheet, sheetStyle]}>

        {/* Handle bar */}
        <View style={m.handle} />

        {/* Scrollable body */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={m.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(260).delay(60)} style={m.header}>
            {/* Face photo */}
            {imageUri ? (
              <View style={m.photoRing}>
                <Image source={{ uri: imageUri }} style={m.photo} resizeMode="cover" />
              </View>
            ) : (
              <View style={[m.photoRing, m.photoFallback]}>
                <Text style={{ fontSize: ms(22) }}>👤</Text>
              </View>
            )}

            {/* Headline */}
            <View style={{ flex: 1 }}>
              <Text style={m.headlineCount}>
                {targets.length}{" "}
                <Text style={m.headlineWord}>{targets.length === 1 ? "trait" : "traits"} to target</Text>
              </Text>
              <Text style={m.headlineSub}>Focus on these things first</Text>
            </View>

            {/* Live pill */}
            <View style={m.livePill}>
              <Animated.View style={[m.liveDot, dotStyle]} />
              <Text style={m.liveText}>LIVE</Text>
            </View>
          </Animated.View>

          {/* Thin divider */}
          <Animated.View
            entering={FadeInDown.duration(200).delay(120)}
            style={m.divider}
          />

          {/* Trait cards */}
          <View style={m.cardList}>
            {targets.map((item, i) => (
              <TraitCard
                key={item.id}
                item={item}
                rank={i + 1}
                enterDelay={i * 65 + 160}
              />
            ))}
          </View>
        </ScrollView>

        {/* CTA — pinned outside scroll */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(targets.length * 65 + 240)}
          style={[m.ctaWrap, { paddingBottom: safeBottom }]}
        >
          <View style={m.ctaDepth}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [
                m.ctaBtn,
                { transform: [{ translateY: pressed ? 4 : 0 }] },
              ]}
            >
              <LinearGradient
                colors={[COLORS.accentLight, COLORS.accent]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={m.ctaText}>Got it</Text>
            </Pressable>
          </View>
        </Animated.View>

      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PHOTO_SIZE    = ms(52);
const LIVE_DOT_SIZE = sw(7);

const m = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  sheet: {
    position:            "absolute",
    bottom:              0,
    left:                0,
    right:               0,
    backgroundColor:     "#FFFFFF",
    borderTopLeftRadius:  ms(28),
    borderTopRightRadius: ms(28),
    maxHeight:           "82%",
    shadowColor:         "#000000",
    shadowOpacity:       0.30,
    shadowRadius:        40,
    shadowOffset:        { width: 0, height: -12 },
    elevation:           24,
    overflow:            "hidden",
  },
  handle: {
    alignSelf:       "center",
    width:           sw(38),
    height:          sh(4),
    borderRadius:    999,
    backgroundColor: "#D8D8D8",
    marginTop:       sh(10),
    marginBottom:    sh(4),
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingTop:        sh(14),
    paddingBottom:     sh(8),
    gap:               sh(12),
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           sw(12),
  },
  photoRing: {
    width:        PHOTO_SIZE,
    height:       PHOTO_SIZE,
    borderRadius: 999,
    borderWidth:  2,
    borderColor:  COLORS.accentBorder,
    overflow:     "hidden",
    flexShrink:   0,
  },
  photo: {
    width:  "100%",
    height: "100%",
  },
  photoFallback: {
    backgroundColor: "#F0F0F0",
    alignItems:      "center",
    justifyContent:  "center",
  },
  headlineCount: {
    fontSize:      ms(18, 0.3),
    fontFamily:    Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color:         "#111111",
    letterSpacing: -0.4,
    lineHeight:    ms(24),
  },
  headlineWord: {
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color:      "rgba(0,0,0,0.50)",
  },
  headlineSub: {
    fontSize:   ms(11.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color:      "#AAAAAA",
    marginTop:  sh(2),
  },
  livePill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               sw(5),
    backgroundColor:   "rgba(80,140,0,0.08)",
    borderWidth:       1,
    borderColor:       "rgba(80,140,0,0.22)",
    borderRadius:      999,
    paddingHorizontal: sw(9),
    paddingVertical:   sh(5),
    alignSelf:         "flex-start",
  },
  liveDot: {
    width:           LIVE_DOT_SIZE,
    height:          LIVE_DOT_SIZE,
    borderRadius:    999,
    backgroundColor: "#6B9A1E",
  },
  liveText: {
    fontSize:      ms(9, 0.3),
    fontFamily:    Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color:         "#6B9A1E",
    letterSpacing: 1.2,
  },

  // ── Divider ──
  divider: {
    height:           sh(1),
    backgroundColor:  "rgba(0,0,0,0.07)",
    marginHorizontal: sw(-16),
  },

  // ── Card list ──
  cardList: {
    gap: sh(8),
  },

  // ── CTA ──
  ctaWrap: {
    paddingHorizontal: sw(16),
    paddingTop:        sh(12),
    backgroundColor:   "#FFFFFF",
    borderTopWidth:    1,
    borderTopColor:    "rgba(0,0,0,0.07)",
  },
  ctaDepth: {
    borderRadius:    ms(18),
    backgroundColor: COLORS.accentDepth,
    paddingBottom:   sh(5),
  },
  ctaBtn: {
    borderRadius:    ms(18),
    height:          sh(54),
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },
  ctaText: {
    fontSize:     ms(16, 0.3),
    fontFamily:   Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color:        "#0B1A00",
    letterSpacing: -0.2,
  },
});
