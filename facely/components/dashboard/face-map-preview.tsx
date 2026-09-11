import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, ChevronRight } from "lucide-react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import T from "@/components/ui/T";
import { FaceMapArt } from "./face-map-art";
import { FACE_AREAS, FACE_MAP as theme, type FaceArea } from "./face-map-theme";

export function FaceMapPreview({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [selected, setSelected] = useState<FaceArea>("cheeks");
  const [colored, setColored] = useState(true);
  const area = FACE_AREAS.find(item => item.id === selected)!;
  const state = theme.states[area.status];
  const stageWidth = Math.min(width - 32, 400);
  const scale = stageWidth / 360;
  const largeText = fontScale > 1.3;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.rail}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to progress" style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ArrowLeft size={22} color={theme.ink} strokeWidth={2} />
        </Pressable>
        <T style={styles.railTitle}>Face map</T>
        <View style={styles.previewPill}><T style={styles.previewText}>PREVIEW</T></View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.inner}>
          <View style={styles.heading}>
            <T accessibilityRole="header" style={styles.title}>Your face, in focus.</T>
            <T style={styles.subtitle}>Small areas. Room to grow.</T>
          </View>

          <View style={styles.modeRow}>
            {[{ label: "Color map", value: true }, { label: "Plain face", value: false }].map(mode => (
              <Pressable key={mode.label} onPress={() => setColored(mode.value)} accessibilityRole="button" accessibilityState={{ selected: colored === mode.value }} style={({ pressed }) => [styles.mode, colored === mode.value && styles.modeActive, pressed && styles.pressed]}>
                <T style={[styles.modeText, colored === mode.value && styles.modeTextActive]}>{mode.label}</T>
              </Pressable>
            ))}
          </View>

          <View style={[styles.stage, { width: stageWidth, height: stageWidth * 380 / 360 }]}>
            <FaceMapArt selected={selected} colored={colored} onSelect={setSelected} />
            {!largeText && FACE_AREAS.map(item => {
              const palette = theme.states[item.status];
              const active = selected === item.id;
              return (
                <Pressable key={item.id} onPress={() => setSelected(item.id)} accessibilityRole="button" accessibilityLabel={item.name + ", " + palette.label} accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.label, { top: item.top * scale, [item.side]: 0 }, active && { backgroundColor: palette.surface }, pressed && styles.pressed]}>
                  <View style={[styles.dot, { backgroundColor: colored ? palette.fill : theme.muted }]} />
                  <T style={[styles.labelText, active && { color: palette.ink }]}>{item.name}</T>
                </Pressable>
              );
            })}
          </View>

          {largeText && <View style={styles.areaButtons}>{FACE_AREAS.map(item => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: selected === item.id }} onPress={() => setSelected(item.id)} style={[styles.largeArea, selected === item.id && { backgroundColor: theme.states[item.status].surface }]}>
              <T style={styles.labelText}>{item.name}</T>
            </Pressable>
          ))}</View>}

          <T style={styles.hint}>Tap a face area to take a closer look</T>
          <View style={styles.legend}>
            {Object.values(theme.states).map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: item.fill }]} />
                <T style={styles.legendText}>{item.label}</T>
              </View>
            ))}
          </View>

          <View style={styles.detail} accessibilityLiveRegion="polite">
            <Animated.View key={selected} entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}>
              <View style={styles.detailTop}>
                <View>
                  <T style={styles.detailEyebrow}>IN FOCUS</T>
                  <T style={styles.detailTitle}>{area.name}</T>
                </View>
                <View style={[styles.status, { backgroundColor: state.surface }]}>
                  {area.status === "well" ? <Check size={14} color={state.ink} strokeWidth={2.5} /> : <View style={[styles.dot, { backgroundColor: state.fill }]} />}
                  <T style={[styles.statusText, { color: state.ink }]}>{state.label}</T>
                </View>
              </View>
              <T style={styles.detailCopy}>{area.description}</T>
              <View style={styles.detailFooter}>
                <View style={styles.pagination}>{FACE_AREAS.map(item => <View key={item.id} style={[styles.pageDot, item.id === selected && styles.pageDotActive]} />)}</View>
                <Pressable accessibilityRole="button" accessibilityLabel="Explore next face area" onPress={() => setSelected(FACE_AREAS[(FACE_AREAS.findIndex(item => item.id === selected) + 1) % FACE_AREAS.length].id)} style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
                  <T style={styles.nextText}>Next area</T><ChevronRight size={16} color={theme.ink} />
                </Pressable>
              </View>
            </Animated.View>
          </View>
          <T style={styles.example}>Example colors and notes, not your scan results.</T>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  rail: { width: "100%", maxWidth: 460, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, borderRadius: 16, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  railTitle: { fontFamily: theme.medium, fontSize: 16, color: theme.ink },
  previewPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: "#EAECE4" },
  previewText: { fontFamily: theme.bold, fontSize: 10, letterSpacing: 1, color: "#636C5D" },
  scroll: { alignItems: "center", paddingHorizontal: 16 },
  inner: { width: "100%", maxWidth: 400, alignItems: "center" },
  heading: { paddingTop: 20, gap: 7, alignItems: "center" },
  title: { fontFamily: theme.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.7, color: theme.ink, textAlign: "center" },
  subtitle: { fontFamily: theme.font, fontSize: 16, lineHeight: 22, color: theme.muted, textAlign: "center" },
  modeRow: { marginTop: 22, padding: 4, flexDirection: "row", borderRadius: 18, backgroundColor: "#EBEDE5" },
  mode: { minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  modeActive: { backgroundColor: theme.surface },
  modeText: { fontFamily: theme.medium, fontSize: 13, color: theme.muted },
  modeTextActive: { color: theme.ink },
  stage: { marginTop: 12 },
  label: { position: "absolute", minHeight: 44, paddingHorizontal: 8, flexDirection: "row", gap: 5, alignItems: "center", borderRadius: 14, backgroundColor: theme.background },
  dot: { width: 8, height: 8, borderRadius: 4 },
  labelText: { fontFamily: theme.medium, fontSize: 12, color: theme.ink },
  hint: { fontFamily: theme.font, fontSize: 12, lineHeight: 18, color: theme.muted, textAlign: "center", marginTop: -6 },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 15, rowGap: 10, paddingVertical: 20 },
  legendItem: { flexDirection: "row", gap: 6, alignItems: "center" },
  legendText: { fontFamily: theme.medium, fontSize: 11, lineHeight: 16, color: theme.muted },
  detail: { alignSelf: "stretch", padding: 22, paddingBottom: 10, backgroundColor: theme.surface, borderRadius: 26 },
  detailTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  detailEyebrow: { fontFamily: theme.bold, fontSize: 10, letterSpacing: 1.5, color: theme.muted },
  detailTitle: { fontFamily: theme.bold, fontSize: 26, lineHeight: 32, color: theme.ink, marginTop: 5 },
  status: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 },
  statusText: { fontFamily: theme.medium, fontSize: 12 },
  detailCopy: { fontFamily: theme.font, fontSize: 15, lineHeight: 22, color: theme.muted, marginTop: 12 },
  detailFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 },
  pagination: { flexDirection: "row", gap: 5 },
  pageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#DFE3D9" },
  pageDotActive: { width: 16, backgroundColor: "#5E7850" },
  next: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  nextText: { fontFamily: theme.medium, fontSize: 12, color: theme.ink },
  example: { fontFamily: theme.font, fontSize: 11, lineHeight: 17, color: theme.muted, textAlign: "center", marginTop: 18 },
  pressed: { opacity: 0.65 },
  areaButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  largeArea: { minHeight: 44, padding: 12, borderRadius: 14, backgroundColor: theme.surface },
});

