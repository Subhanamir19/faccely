// app/history/analysis-card.tsx
// Historical advanced analysis — mirrors (tabs)/analysis.tsx UI.
//
// Note: advanced analysis payloads aren't persisted per-scan server-side, so
// we can only show the full UI for the scan that's currently in the
// useAdvancedAnalysis store (i.e. the most recent one the user viewed live).
// Older scans render a graceful empty state pointing back to the score card.

import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Microscope, ChevronRight } from "lucide-react-native";

import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sw, sh } from "@/lib/responsive";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { AnalysisContent } from "../(tabs)/analysis";

export default function HistoryAnalysisCard() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = params?.scanId;

  const data = useAdvancedAnalysis((s) => s.data);
  const cachedScanId = useAdvancedAnalysis((s) => s.cachedScanId);
  const matches = !!data && !!scanId && cachedScanId === scanId;

  const handleBack = () => router.back();
  const handleBackToScore = () => {
    router.replace(
      `/history/score-card?scanId=${encodeURIComponent(scanId ?? "")}`
    );
  };

  return (
    <View style={sx.screen}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[sx.safeArea, { paddingTop: insets.top }]}>
        {/* ── Top bar with back button ── */}
        <View style={sx.topBar}>
          <BackButton onPress={handleBack} />
        </View>

        {/* ── Header shown for non-content states ── */}
        {!matches && (
          <Animated.View entering={FadeInDown.duration(360)} style={sx.header}>
            <Text style={sx.headerTitle}>Advanced Analysis</Text>
            <Text style={sx.headerSub}>Your detailed facial breakdown</Text>
          </Animated.View>
        )}

        <ScrollView
          style={sx.scroll}
          contentContainerStyle={[
            sx.scrollContent,
            { paddingBottom: insets.bottom + SP[8] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {matches ? (
            <AnalysisContent data={data!} />
          ) : (
            <HistoricalEmptyState onBack={handleBackToScore} />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Empty state: advanced analysis not available for this scan ───────────

function HistoricalEmptyState({ onBack }: { onBack: () => void }) {
  return (
    <View style={sx.emptyWrap}>
      <Animated.View entering={FadeInDown.duration(380)} style={sx.emptyIconFrame}>
        <View style={sx.emptyIconGlow} />
        <View style={sx.emptyIconCore}>
          <Microscope size={ms(30)} color={COLORS.accent} strokeWidth={1.8} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(380).delay(80)} style={sx.emptyLabelRow}>
        <View style={sx.emptyLabelDot} />
        <Text style={sx.emptyLabelText}>ADVANCED ANALYSIS</Text>
      </Animated.View>

      <Animated.Text entering={FadeInDown.duration(380).delay(140)} style={sx.emptyTitle}>
        Not available for this scan
      </Animated.Text>

      <Animated.Text entering={FadeInDown.duration(380).delay(200)} style={sx.emptySub}>
        The detailed sub-metric breakdown is generated live and only kept for
        your most recent scan. Run a new scan to see the full breakdown.
      </Animated.Text>

      <Animated.View
        entering={FadeInDown.duration(380).delay(300)}
        style={sx.emptyCta}
      >
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            sx.ctaBtn,
            { transform: [{ translateY: pressed ? 5 : 0 }] },
          ]}
        >
          <LinearGradient
            colors={[COLORS.accentLight, COLORS.accent]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={sx.ctaBtnText}>View Scores Instead</Text>
          <ChevronRight size={ms(16)} color="#0B1A00" strokeWidth={2.6} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const sx = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },

  topBar: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    paddingBottom: SP[2],
  },

  header: {
    alignItems: "center",
    paddingHorizontal: sw(20),
    paddingTop: sh(8),
    paddingBottom: sh(10),
  },
  headerTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: ms(22),
    color: COLORS.text,
    textAlign: "center",
  },
  headerSub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(13),
    color: COLORS.sub,
    textAlign: "center",
    marginTop: sh(4),
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: sw(24),
    paddingTop: sh(36),
    gap: sh(10),
  },
  emptyIconFrame: {
    width: ms(84),
    height: ms(84),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sh(8),
  },
  emptyIconGlow: {
    position: "absolute",
    width: ms(84),
    height: ms(84),
    borderRadius: ms(42),
    backgroundColor: COLORS.accentGlow,
  },
  emptyIconCore: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(30),
    backgroundColor: "rgba(180,243,77,0.10)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginTop: sh(4),
  },
  emptyLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  emptyLabelText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: ms(10),
    letterSpacing: 1.5,
    color: COLORS.accent,
  },
  emptyTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: ms(22),
    color: COLORS.text,
    textAlign: "center",
    marginTop: sh(4),
  },
  emptySub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: ms(20),
    maxWidth: sw(300),
  },
  emptyCta: {
    marginTop: sh(20),
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentDepth,
    paddingBottom: 5,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: RADII.pill,
    overflow: "hidden",
  },
  ctaBtnText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: ms(15),
    color: "#0B1A00",
  },
});
