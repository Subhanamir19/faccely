// facely/components/scores/InsightRevealCard.tsx
// New scoring UI: two-section insight reveal with scanning simulation.
// "What's working" and "Needs attention" replace raw score grid.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
  ScrollView,
} from "react-native";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Thresholds ──────────────────────────────────────────────────────────────
const WORKING_THRESHOLD = 65; // score >= this → "working"
const SCAN_DURATION_MS  = 2600; // how long the scanning phase lasts

// ─── Tier helpers (same logic as ScoresSummaryCard) ──────────────────────────
function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.accent;        // lime — great
  if (score >= 65) return "#C8DA45";            // chartreuse — good
  if (score >= 50) return COLORS.warning;       // amber — average
  return COLORS.error;                          // red — needs work
}

const TIER_LABELS: [number, string][] = [
  [90, "Elite"],
  [80, "Strong"],
  [70, "Good"],
  [60, "Average"],
  [50, "Fair"],
  [40, "Weak"],
  [0,  "Poor"],
];
function getTierLabel(score: number): string {
  for (const [threshold, label] of TIER_LABELS) {
    if (score >= threshold) return label;
  }
  return "Poor";
}

// ─── Scan phase cycling text ──────────────────────────────────────────────────
const SCAN_STEPS = [
  "Mapping facial structure…",
  "Analyzing jawline geometry…",
  "Measuring symmetry ratios…",
  "Evaluating cheekbone depth…",
  "Reading skin quality markers…",
  "Calculating eye harmony…",
  "Compiling insights…",
];

// ─── Animated bar for each insight row ───────────────────────────────────────
function InsightBar({
  label,
  score,
  delay,
  active,
  isWorking,
}: {
  label: string;
  score: number;
  delay: number;
  active: boolean;
  isWorking: boolean;
}) {
  const fillAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  const color = getScoreColor(score);
  const tier  = getTierLabel(score);

  useEffect(() => {
    if (!active) return;
    fillAnim.setValue(0);
    fadeAnim.setValue(0);

    // Fade the whole row in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Fill bar
    Animated.timing(fillAnim, {
      toValue: score,
      duration: 800,
      delay: delay + 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Count-up number
    const countAnim = new Animated.Value(0);
    const listener = countAnim.addListener(({ value }) => setDisplayed(Math.round(value)));
    Animated.timing(countAnim, {
      toValue: score,
      duration: 900,
      delay: delay + 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => countAnim.removeListener(listener));
    return () => countAnim.removeListener(listener);
  }, [active, score, delay]);

  const barWidth = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[styles.insightRow, { opacity: fadeAnim }]}>
      {/* Left: label */}
      <Text style={styles.insightLabel} numberOfLines={1}>{label}</Text>

      {/* Center: bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { width: barWidth, backgroundColor: color }]}
        />
      </View>

      {/* Right: tier chip */}
      <View style={[styles.tierChip, { borderColor: color + "55" }]}>
        <Text style={[styles.tierText, { color }]}>{tier}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Scanning simulation phase ────────────────────────────────────────────────
function ScanningPhase({ visible }: { visible: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const pulseAnim  = useRef(new Animated.Value(0.4)).current;
  const scanAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(1)).current;

  // Cycle text
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % SCAN_STEPS.length);
    }, 380);
    return () => clearInterval(id);
  }, [visible]);

  // Pulse the outer glow ring
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible]);

  // Scan line sweeping down
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0,    useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible]);

  const FACE_H = 110;
  const scanLineY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FACE_H] });

  if (!visible) return null;

  return (
    <View style={styles.scanPhase}>
      {/* Face silhouette with scan line */}
      <View style={[styles.faceBox, { height: FACE_H }]}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((x) => (
          <View
            key={x}
            style={[styles.gridLine, { left: `${x * 100}%`, width: 1, height: "100%" }]}
          />
        ))}
        {[0.33, 0.66].map((y) => (
          <View
            key={y}
            style={[styles.gridLine, { top: `${y * 100}%`, height: 1, width: "100%" }]}
          />
        ))}
        {/* Corner accents */}
        <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
        <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
        {/* Moving scan line */}
        <Animated.View style={[styles.scanLine, { top: scanLineY }]} />
      </View>

      {/* Pulsing label */}
      <Animated.View style={{ opacity: pulseAnim, marginTop: SP[4] }}>
        <Text style={styles.scanLabel}>{SCAN_STEPS[stepIndex]}</Text>
      </Animated.View>

      {/* Dot progress */}
      <View style={styles.dotRow}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { opacity: pulseAnim, backgroundColor: COLORS.accent },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────
function InsightSection({
  title,
  icon,
  color,
  metrics,
  active,
  startDelay,
}: {
  title: string;
  icon: string;
  color: string;
  metrics: { label: string; score: number }[];
  active: boolean;
  startDelay: number;
}) {
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 350,
      delay: startDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, startDelay]);

  if (metrics.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Header */}
      <Animated.View style={[styles.sectionHeader, { opacity: headerFade }]}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color }]}>{icon}  {title}</Text>
      </Animated.View>

      {/* Rows */}
      {metrics.map((m, i) => (
        <InsightBar
          key={m.label}
          label={m.label}
          score={m.score}
          delay={startDelay + 80 + i * 120}
          active={active}
          isWorking={color === COLORS.accent}
        />
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export type InsightMetric = { label: string; score: number };

export default function InsightRevealCard({
  metrics,
  totalScore,
  imageUri,
  active = true,
}: {
  metrics: InsightMetric[];
  totalScore: number;
  imageUri?: string | null;
  active?: boolean;
}) {
  const [phase, setPhase] = useState<"scanning" | "reveal">("scanning");

  // Transition after scan duration
  useEffect(() => {
    if (!active) return;
    setPhase("scanning");
    const t = setTimeout(() => setPhase("reveal"), SCAN_DURATION_MS);
    return () => clearTimeout(t);
  }, [active]);

  // Split metrics
  const working   = metrics.filter((m) => m.score >= WORKING_THRESHOLD);
  const attention = metrics.filter((m) => m.score <  WORKING_THRESHOLD);

  // Stagger: attention section starts after all working bars
  const workingEnd = 80 + working.length * 120 + 800;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile image + score pill */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>?</Text>
            </View>
          )}
        </View>

        <View style={styles.overallPill}>
          <Text style={styles.overallScore}>{totalScore}</Text>
          <Text style={styles.overallLabel}>Overall</Text>
        </View>
      </View>

      {/* Phase: scanning */}
      {phase === "scanning" && <ScanningPhase visible />}

      {/* Phase: reveal */}
      {phase === "reveal" && (
        <View style={styles.revealWrap}>
          <InsightSection
            title="What's working"
            icon="✦"
            color={COLORS.accent}
            metrics={working}
            active
            startDelay={0}
          />
          <View style={styles.sectionGap} />
          <InsightSection
            title="Needs attention"
            icon="△"
            color={COLORS.warning}
            metrics={attention}
            active
            startDelay={workingEnd}
          />
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[10],
    gap: SP[4],
  },

  // Top row
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
    marginBottom: SP[2],
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    backgroundColor: COLORS.track,
  },
  avatar: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    fontSize: 26,
    color: COLORS.sub,
  },
  overallPill: {
    flex: 1,
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderRadius: RADII.xl,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: "row",
    alignItems: "baseline",
    gap: SP[2],
  },
  overallScore: {
    fontSize: 40,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    lineHeight: 48,
  },
  overallLabel: {
    fontSize: 13,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },

  // Scanning phase
  scanPhase: {
    alignItems: "center",
    paddingVertical: SP[6],
    gap: SP[3],
  },
  faceBox: {
    width: 160,
    borderRadius: RADII.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.25)",
    overflow: "hidden",
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(180,243,77,0.08)",
  },
  corner: {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: COLORS.accent,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.accent,
    opacity: 0.7,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  scanLabel: {
    fontSize: 14,
    color: COLORS.accent,
    fontFamily: "Poppins-Regular",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  dotRow: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Reveal sections
  revealWrap: {
    gap: 0,
  },
  sectionGap: {
    height: SP[6],
  },

  // Section
  section: {
    gap: SP[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginBottom: SP[1],
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Insight row
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  insightLabel: {
    width: 110,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: "Poppins-Regular",
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  tierChip: {
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 52,
    alignItems: "center",
  },
  tierText: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },
});
