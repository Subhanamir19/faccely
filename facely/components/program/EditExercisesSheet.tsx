// components/program/EditExercisesSheet.tsx
// Bottom sheet for the "Edit" action — full catalog of exercises grouped by
// target area with the currently-included ones checked. Live count + duration
// header so the user sees impact in real time. Confirms by replacing today's
// task list while preserving completion status of surviving entries.

import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
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
import { getExerciseIcon } from "@/lib/exerciseIcons";
import {
  EXERCISE_CATALOG,
  type ExerciseEntry,
  type TargetArea,
} from "@/lib/taskSelection";
import { useExerciseSettings } from "@/store/exerciseSettings";

function formatSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Group order for the section list. Anything else falls under "Other".
const GROUP_ORDER: TargetArea[] = ["jawline", "cheekbones", "eyes", "nose", "skin", "all"];

function primaryArea(e: ExerciseEntry): TargetArea {
  for (const a of GROUP_ORDER) if (e.targets.includes(a)) return a;
  return "all";
}

export default function EditExercisesSheet({
  visible,
  initialIds,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  initialIds: string[];
  onConfirm: (ids: string[]) => void;
  onDismiss: () => void;
}) {
  const { getDuration } = useExerciseSettings();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));

  useEffect(() => {
    if (visible) setSelected(new Set(initialIds));
  }, [visible, initialIds]);

  const grouped = useMemo(() => {
    const map = new Map<TargetArea, ExerciseEntry[]>();
    for (const e of EXERCISE_CATALOG) {
      const k = primaryArea(e);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return GROUP_ORDER
      .map((k) => ({ key: k, items: map.get(k) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, []);

  const totalSecs = useMemo(
    () => Array.from(selected).reduce((sum, id) => sum + getDuration(id), 0),
    [selected, getDuration],
  );

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (selected.size === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Preserve the catalog order so the resulting list is deterministic.
    const ordered = EXERCISE_CATALOG
      .filter((e) => selected.has(e.id))
      .map((e) => e.id);
    onConfirm(ordered);
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
          entering={SlideInDown.duration(280).springify().damping(20)}
          exiting={SlideOutDown.duration(220)}
          style={s.sheet}
        >
          <View style={s.handle} />

          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Edit Routine</Text>
              <Text style={s.subtitle}>Tap to add or remove from today</Text>
            </View>
            <View style={s.statBlock}>
              <Text style={s.statNum}>{selected.size}</Text>
              <Text style={s.statLabel}>{formatSecs(totalSecs)}</Text>
            </View>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {grouped.map((group) => (
              <View key={group.key} style={s.group}>
                <Text style={s.groupTitle}>{CARD_FACE_LABELS[group.key] ?? group.key}</Text>
                {group.items.map((e) => {
                  const on = selected.has(e.id);
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => toggle(e.id)}
                      style={({ pressed }) => [
                        s.row,
                        on && s.rowOn,
                        pressed && s.rowPressed,
                      ]}
                    >
                      <View style={s.iconTile}>
                        <Image source={getExerciseIcon(e.id)} style={s.iconImg} />
                      </View>
                      <View style={s.rowText}>
                        <Text style={s.rowTitle} numberOfLines={2}>
                          {e.name.toUpperCase()}
                        </Text>
                        <Text style={s.rowSub} numberOfLines={1}>
                          {e.targets.map((t) => CARD_FACE_LABELS[t] ?? t).join(", ")}
                        </Text>
                      </View>
                      <View style={[s.checkbox, on && s.checkboxOn]}>
                        {on && <Check size={ms(16)} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <Pressable
              onPress={handleSave}
              disabled={selected.size === 0}
              style={({ pressed }) => [
                s.saveBtn,
                selected.size === 0 && s.saveBtnDisabled,
                pressed && selected.size > 0 && s.saveBtnPressed,
              ]}
            >
              <Text style={s.saveText}>
                {selected.size === 0 ? "PICK AT LEAST ONE" : "SAVE ROUTINE"}
              </Text>
            </Pressable>
          </View>
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
    height: "85%",
  },
  handle: {
    alignSelf: "center",
    width: sw(44),
    height: sh(4),
    borderRadius: 999,
    backgroundColor: COLORS.lightBorder,
    marginBottom: SP[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
    marginTop: sh(2),
  },
  statBlock: {
    alignItems: "flex-end",
    paddingHorizontal: sw(14),
    paddingVertical: sh(8),
    borderRadius: RADII.md,
    backgroundColor: COLORS.lightSurface,
  },
  statNum: {
    ...TYPE.proximaStatNum,
    fontSize: ms(20),
    color: COLORS.lightText,
  },
  statLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
    color: COLORS.lightSub,
    marginTop: sh(1),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SP[4],
  },
  group: {
    marginBottom: SP[5],
  },
  groupTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    letterSpacing: 1,
    color: COLORS.lightSub,
    textTransform: "uppercase",
    marginBottom: SP[3],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    paddingVertical: sh(10),
    paddingHorizontal: sw(12),
    borderRadius: RADII.md,
    backgroundColor: COLORS.lightChipBg,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    marginBottom: sh(8),
  },
  rowOn: {
    borderColor: COLORS.ctaBlack,
  },
  rowPressed: {
    opacity: 0.85,
  },
  iconTile: {
    width: ms(44),
    height: ms(44),
    borderRadius: RADII.sm,
    backgroundColor: "#F7F8F4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.08)",
  },
  iconImg: {
    width: "92%",
    height: "92%",
    borderRadius: RADII.xs,
    resizeMode: "cover",
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...TYPE.proximaExerciseTitle,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  rowSub: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(12),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },
  checkbox: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    borderWidth: 2,
    borderColor: COLORS.lightBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: COLORS.ctaBlack,
    borderColor: COLORS.ctaBlack,
  },
  footer: {
    paddingTop: SP[3],
    paddingBottom: SP[5],
    borderTopWidth: 1,
    borderTopColor: COLORS.lightDivider,
  },
  saveBtn: {
    minHeight: sh(56),
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: sh(16),
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  saveBtnPressed: {
    backgroundColor: COLORS.ctaBlackPressed,
  },
  saveText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(16),
    letterSpacing: 0.4,
    color: "#FFFFFF",
    textAlign: "center",
  },
});
