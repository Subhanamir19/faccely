// components/program/TargetAreasSheet.tsx
// Bottom sheet for the "Select" action on the routine preview screen.
// User toggles which face areas today's routine should target. On confirm,
// today's exercise list is regenerated from EXERCISE_CATALOG filtered to those
// areas (preserving completion state for surviving exercises).

import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";

import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import { CARD_FACE_LABELS } from "@/lib/faceTargets";
import type { TargetArea } from "@/lib/taskSelection";

const AREAS: TargetArea[] = ["jawline", "cheekbones", "eyes", "nose", "skin", "all"];

export default function TargetAreasSheet({
  visible,
  initialAreas,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  initialAreas: TargetArea[];
  onConfirm: (areas: TargetArea[]) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<Set<TargetArea>>(new Set(initialAreas));

  useEffect(() => {
    if (visible) setSelected(new Set(initialAreas));
  }, [visible, initialAreas]);

  const toggle = (a: TargetArea) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const handleApply = () => {
    if (selected.size === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(Array.from(selected));
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View entering={FadeIn.duration(180)} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          entering={SlideInDown.duration(260).springify().damping(20)}
          exiting={SlideOutDown.duration(220)}
          style={s.sheet}
        >
          <View style={s.handle} />
          <Text style={s.title}>Targeted Areas</Text>
          <Text style={s.subtitle}>Pick the zones you want to focus on today</Text>

          <View style={s.chips}>
            {AREAS.map((a) => {
              const on = selected.has(a);
              return (
                <Pressable
                  key={a}
                  onPress={() => toggle(a)}
                  style={({ pressed }) => [
                    s.chip,
                    on && s.chipOn,
                    pressed && s.chipPressed,
                  ]}
                >
                  {on && <Check size={ms(15)} color="#FFFFFF" strokeWidth={2.5} />}
                  <Text style={[s.chipText, on && s.chipTextOn]}>
                    {CARD_FACE_LABELS[a] ?? a}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleApply}
            disabled={selected.size === 0}
            style={({ pressed }) => [
              s.applyBtn,
              selected.size === 0 && s.applyBtnDisabled,
              pressed && selected.size > 0 && s.applyBtnPressed,
            ]}
          >
            <Text style={s.applyText}>
              {selected.size === 0 ? "PICK AT LEAST ONE" : "APPLY"}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FEF5E4",
    borderTopLeftRadius: RADII.card,
    borderTopRightRadius: RADII.card,
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    paddingBottom: SP[6],
  },
  handle: {
    alignSelf: "center",
    width: sw(44),
    height: sh(4),
    borderRadius: 999,
    backgroundColor: COLORS.lightBorder,
    marginBottom: SP[4],
  },
  title: {
    ...TYPE.proximaSection,
    fontSize: ms(22),
    color: COLORS.lightText,
  },
  subtitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(4),
    marginBottom: SP[5],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sw(8),
    marginBottom: SP[6],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    paddingHorizontal: sw(16),
    paddingVertical: sh(12),
    borderRadius: RADII.sm,
    backgroundColor: COLORS.lightChipBg,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
  chipOn: {
    backgroundColor: COLORS.ctaBlack,
    borderColor: COLORS.ctaBlack,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    ...TYPE.proximaPill,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  chipTextOn: {
    color: "#FFFFFF",
  },
  applyBtn: {
    minHeight: sh(56),
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: sh(16),
  },
  applyBtnDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  applyBtnPressed: {
    backgroundColor: COLORS.ctaBlackPressed,
  },
  applyText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(16),
    letterSpacing: 0.4,
    color: "#FFFFFF",
    textAlign: "center",
  },
});
