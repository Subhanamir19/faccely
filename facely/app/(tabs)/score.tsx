import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, useWindowDimensions, FlatList, Animated, Easing, Pressable } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Text as SvgText,
  G,
} from "react-native-svg";

/* ============================================================================
   score.tsx — Swipeable metric graphs with glassmorphism score ring,
   percentile insight, tier milestone mini-bar, and Gumroad-style controls
   ========================================================================== */

// Animated SVG bits
const AnimatedCircle: any = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  pageBg: "#F6F8FB",
  card: "#FFFFFF",
  textDark: "#0F0F0F",
  textSubtle: "#687076",
  axis: "#E6E8EB",
  curveStart: "#17C964",
  curveEnd: "#29D3B0",
  glow: "rgba(23,201,100,0.22)",
  ringTrack: "#E9F6F1",
  chipBg: "rgba(255,255,255,0.7)",
  divider: "#EEF1F4",
  progressTrack: "#E9EEF2",
  progressFill: "#2FD3A5",
  lock: "#9AA2A9",
};

const X_LABELS = ["Needs Work", "Sharp", "Iconic", "Elite"] as const;

type MetricItem = {
  key: string;
  score: number;         // 0..100
  percentile?: number;   // defaults to score
  icon?: 'jaw' | 'sym' | 'cheek' | 'dimorph' | 'skin' | 'eyesym' | 'nose' | 'sex';
  locked?: boolean;      // future gating if needed
};

// Full 8 metrics
const DEFAULT_METRICS: MetricItem[] = [
  { key: "Jawline", score: 64, percentile: 64, icon: "jaw" },
  { key: "Symmetry", score: 72, percentile: 72, icon: "sym" },
  { key: "Cheekbones", score: 58, percentile: 58, icon: "cheek" },
  { key: "Sexual Dimorphism", score: 81, percentile: 83, icon: "dimorph" },
  { key: "Skin Quality", score: 69, percentile: 71, icon: "skin" },
  { key: "Eye Symmetry", score: 62, percentile: 60, icon: "eyesym" },
  { key: "Nose Harmony", score: 74, percentile: 76, icon: "nose" },
  { key: "Masculinity/Femininity", score: 77, percentile: 78, icon: "sex" },
];

// Tier model powering labels + milestone logic
const TIERS = [
  { label: "Needs Work", min: 0,  max: 39 },
  { label: "Sharp",      min: 40, max: 69 },
  { label: "Iconic",     min: 70, max: 89 },
  { label: "Elite",      min: 90, max: 100 },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function computeMilestone(score: number) {
  const idx = TIERS.findIndex(t => score >= t.min && score <= t.max);
  const i = idx < 0 ? 0 : idx;
  const current = TIERS[i];
  const next = TIERS[Math.min(TIERS.length - 1, i + 1)];
  const remaining = Math.max(0, next.min - score); // how much to reach next tier floor
  const pctToNext = next.min === current.min ? 1 : Math.min(1, (score - current.min) / (next.min - current.min));
  return { current, next, remaining, pctToNext, tierIndex: i };
}

// ---------------------------------------------------------------------------
// Geometry helpers — Catmull–Rom to Bezier
// ---------------------------------------------------------------------------
function catmullRomToBezier(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

function buildAnchors({
  innerW, innerH, x0, yTop, yBase, score,
}: { innerW: number; innerH: number; x0: number; yTop: number; yBase: number; score: number }) {
  const s = clamp(score, 0, 100);
  const tScore = s / 100;
  const xAt = (t: number) => x0 + t * innerW;
  const yForVal = (val: number) => yTop + (1 - clamp(val, 0, 100) / 100) * innerH;
  const A = s / 100;
  const anchors = [
    { t: 0.0, v: 3 },
    { t: 0.18, v: 28 + 16 * A },
    { t: 0.36, v: 38 + 10 * A },
    { t: tScore, v: s },
    { t: 0.70, v: 60 + 30 * A },
    { t: 1.0, v: 88 + 8 * A },
  ]
    .sort((a, b) => a.t - b.t)
    .filter((p, i, arr) => i === 0 || p.t - arr[i - 1].t > 0.0001)
    .map(({ t, v }) => ({ x: xAt(t), y: yForVal(v) }));
  return anchors;
}

// ---------------------------------------------------------------------------
// Header row: tiny icon chip + title + info button
// ---------------------------------------------------------------------------
function HeaderRow({ title, icon = 'jaw', onInfo }: { title: string; icon?: MetricItem['icon']; onInfo?: () => void }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.iconChip}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          {/* minimalist jaw icon */}
          <Path d="M4 9c0-3.5 3.2-6 8-6s8 2.5 8 6c0 4.5-3.5 9-8 9s-8-4.5-8-9z" fill="#DCE6EF"/>
          <Path d="M7 11c1.8 2.2 4 3.3 5 3.3S15.2 13.2 17 11" stroke="#0F0F0F" strokeWidth={1.4} strokeLinecap="round"/>
        </Svg>
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <Pressable hitSlop={8} onPress={onInfo} style={styles.infoBtn}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="10" stroke="#C7D0D8" strokeWidth="1.2" fill="#FFFFFF" />
          <Path d="M12 8.2a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z" fill="#0F0F0F"/>
          <Path d="M11.1 10.7h1.8v6.1h-1.8z" fill="#0F0F0F"/>
        </Svg>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// GlassRing: animated circular score
// ---------------------------------------------------------------------------
function GlassRing({ value, active }: { value: number; active: boolean }) {
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 850 : 250,
      easing: active ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [c, c * (1 - clamp(value, 0, 100) / 100)] });
  const displayValue = progress.interpolate({ inputRange: [0, 1], outputRange: [0, clamp(value, 0, 100)] });
  const pctText = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`0%`, `${clamp(value, 0, 100)}%`],
  });
  
  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={COLORS.curveStart} />
            <Stop offset="100%" stopColor={COLORS.curveEnd} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill="#FFFFFF" opacity={0.9} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.ringTrack} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${2 * Math.PI * r}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <Animated.Text style={styles.ringText as any}>
  {pctText as unknown as string}
</Animated.Text>

    </View>
  );
}

// ---------------------------------------------------------------------------
// InsightBlock: percentile sentence + mini milestone progress bar
// ---------------------------------------------------------------------------
function InsightBlock({
  metricLabel,
  score,
  percentile = score,
  active,
}: { metricLabel: string; score: number; percentile?: number; active: boolean }) {
  const { next, remaining } = computeMilestone(score);

  // model-standards match %
  const pct = Math.max(0, Math.min(100, percentile)) / 100;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? pct : 0,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, pct]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.insightCol}>
      <Text style={styles.insightLead}>
        Your {metricLabel.toLowerCase()} matches <Text style={styles.bold}>{percentile}%</Text> of the aesthetician’s defined Model face standards.
      </Text>

      <View style={styles.miniBar}>
        <Animated.View style={[styles.miniFill, { width }]} />
        <View style={styles.miniLockWrap}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M7 10V8a5 5 0 0 1 10 0v2" stroke={COLORS.lock} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
            <Path d="M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8z" fill={COLORS.lock} opacity={0.35}/>
          </Svg>
        </View>
      </View>

      <Text style={styles.miniLabel}>
        Next Milestone: <Text style={styles.bold}>{next.label}</Text> ({remaining}%)
      </Text>
    </View>
  );
}


// ---------------------------------------------------------------------------
// MetricCard: full card with header, graph, ring + insight, milestone bar
// ---------------------------------------------------------------------------
function MetricCard({ item, width, active }: { item: MetricItem; width: number; active: boolean }) {
  const { key: title, score, percentile, icon } = item;

  const graphH = 280;
  const leftPad = 36;
  const rightPad = 16;
  const topPad = 24;
  const bottomPad = 56;

  const innerW = width - leftPad - rightPad;
  const innerH = graphH - topPad - bottomPad;
  const yBase = graphH - bottomPad;

  const anchors = useMemo(() => buildAnchors({ innerW, innerH, x0: leftPad, yTop: topPad, yBase, score }), [innerW, innerH, leftPad, topPad, yBase, score]);
  const strokePath = useMemo(() => catmullRomToBezier(anchors), [anchors]);
  const fillPath = useMemo(() => {
    const last = anchors[anchors.length - 1];
    const first = anchors[0];
    return `${catmullRomToBezier(anchors)} L ${last.x} ${yBase} L ${first.x} ${yBase} Z`;
  }, [anchors, yBase]);

  // Marker coordinates
  const markerX = leftPad + (clamp(score, 0, 100) / 100) * innerW;
  const markerY = useMemo(() => {
    let y = anchors[0].y;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (markerX >= a.x && markerX <= b.x) {
        const t = (markerX - a.x) / (b.x - a.x);
        y = a.y + t * (b.y - a.y);
        break;
      }
    }
    return y;
  }, [anchors, markerX]);

  // Active pulsing glow for the dot
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (active) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ])
      );
      loop.start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
    return () => loop?.stop();
  }, [active, pulse]);
  const glowR = pulse.interpolate({ inputRange: [0, 1], outputRange: [14, 18] });
  const glowOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.35] });

  const { tierIndex } = computeMilestone(score);

  return (
    <View style={[styles.card, { width }]}>
      <HeaderRow title={title} icon={icon} onInfo={() => { /* open sheet/tooltip if needed */ }} />

      <Svg width={width} height={graphH}>
        <Defs>
          <LinearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={COLORS.curveStart} />
            <Stop offset="100%" stopColor={COLORS.curveEnd} />
          </LinearGradient>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={COLORS.curveEnd} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={COLORS.curveEnd} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Axes */}
        <Line x1={leftPad} y1={topPad} x2={leftPad} y2={yBase} stroke={COLORS.axis} strokeWidth={1} />
        <Line x1={leftPad} y1={yBase} x2={width - rightPad} y2={yBase} stroke={COLORS.axis} strokeWidth={1} />

        {/* Y ticks */}
        {[0, 50, 100].map((val, i) => {
          const y = topPad + (1 - val / 100) * innerH;
          return (
            <G key={`yt-${i}`}>
              {i !== 0 && <Line x1={leftPad} y1={y} x2={width - rightPad} y2={y} stroke={COLORS.axis} strokeWidth={0.75} opacity={0.32} />}
              <SvgText x={leftPad - 8} y={y + 4} fontSize={11} fill={COLORS.textSubtle} textAnchor="end">{val}</SvgText>
            </G>
          );
        })}

        {/* Area + stroke */}
        <Path d={fillPath} fill="url(#areaGrad)" />
        <Path d={strokePath} fill="none" stroke="url(#strokeGrad)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* Marker guide + pulsing dot */}
        <Line x1={markerX} y1={topPad} x2={markerX} y2={yBase} stroke={COLORS.curveEnd} strokeWidth={1.2} strokeDasharray="6 6" opacity={0.9} />
        <AnimatedCircle cx={markerX} cy={markerY} r={glowR} fill={COLORS.glow} opacity={glowOp as any} />
        <Circle cx={markerX} cy={markerY} r={9} fill="#fff" />
        <Circle cx={markerX} cy={markerY} r={7} fill="#fff" stroke={COLORS.curveEnd} strokeWidth={2.5} />

        {/* X labels reflecting tiers */}
        {X_LABELS.map((label, i) => {
          const x = leftPad + (i / (X_LABELS.length - 1)) * innerW;
          const activeTier = i === tierIndex || i === Math.min(3, tierIndex + 1);
          return (
            <SvgText key={label} x={x} y={graphH - 20} fill={activeTier ? COLORS.textDark : COLORS.textSubtle} fontSize={13} fontWeight={activeTier ? "700" : "500"} textAnchor="middle">
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Score + insight row */}
      <View style={styles.scoreRow}>
        <GlassRing value={score} active={active} />
        <InsightBlock metricLabel={title} score={score} percentile={percentile} active={active} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen with FlatList + prev/next gum buttons
// ---------------------------------------------------------------------------
export default function ScoreScreen() {
  const { width } = useWindowDimensions();
  const itemWidth = Math.min(760, Math.max(320, width * 0.82));
  const spacer = Math.max(12, width * 0.02);
  const snap = itemWidth + spacer;

  const [metrics, setMetrics] = useState<MetricItem[]>(DEFAULT_METRICS);
  const listRef = useRef<FlatList>(null);

  const getItemLayout = useCallback((_: any, i: number) => ({ length: snap, offset: snap * i, index: i }), [snap]);

  const renderItem = useCallback(
    ({ item, index: i }: { item: MetricItem; index: number }) => (
      <View style={{ width: snap }}>
        <MetricCard item={item} width={itemWidth} active={i === index} />
      </View>
    ),
    [index, itemWidth, snap]
  );

  const scrollTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(METRICS.length - 1, i));
    listRef.current?.scrollToOffset({ offset: clamped * snap, animated: true });
    setIndex(clamped);
  }, [snap]);

  const goPrev = useCallback(() => scrollTo(index - 1), [index, scrollTo]);
  const goNext = useCallback(() => scrollTo(index + 1), [index, scrollTo]);

  return (
    <View style={styles.page}>
      <FlatList
        ref={listRef}
        horizontal
        data={METRICS}
        keyExtractor={(m) => m.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        pagingEnabled={false}
        snapToInterval={snap}
        snapToAlignment="center"
        contentContainerStyle={{ paddingHorizontal: (width - itemWidth) / 2, paddingBottom: 8, alignItems: 'center' }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / snap))}
        getItemLayout={getItemLayout}
        removeClippedSubviews={false}
      />

      {/* Pager dots */}
      <View style={styles.dotsRow}>
        {METRICS.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Gumroad-style controls with subtle glow when enabled */}
      <View style={styles.controlsRow}>
      <GumButton label="Previous" onPress={goPrev} disabled={index === 0} variant="prev" />
<GumButton label="Next" onPress={goNext} disabled={index === METRICS.length - 1} variant="next" />

      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gumroad-style pill button with active glow
// ---------------------------------------------------------------------------
function GumButton({ label, onPress, disabled, variant }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'prev' | 'next' }) {
  const [pressed, setPressed] = useState(false);

  // subtle glow loop on badge when enabled


  return (
    <View style={[styles.gumShadowWrap, disabled && { opacity: 0.55 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [styles.gumButton, pressed && styles.gumButtonPressed]}
      >
        {variant === 'prev' && (
          <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
            <Path d="M14 5l-7 7 7 7" fill="none" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        )}
  
        <Text style={styles.gumLabel}>{label}</Text>
  
        {variant === 'next' && (
          <Svg width={20} height={20} viewBox="0 0 24 24" style={{ marginLeft: 8 }}>
            <Path d="M1.5 12s3.5-6.5 10.5-6.5S22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z" fill="none" stroke="#0F0F0F" strokeWidth="1.8"/>
            <Circle cx="12" cy="12" r="3.2" fill="none" stroke="#0F0F0F" strokeWidth="1.8"/>
          </Svg>
        )}
      </Pressable>
    </View>
  );
  
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingTop: 10,
    paddingBottom: 18,
    // outer shadow (bevel-like)
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "visible",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 6,
    gap: 10,
  },
  iconChip: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.chipBg,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#E7EDF3",
  },
  infoBtn: {
    marginLeft: "auto",
    padding: 2,
  },
  metricTitle: { fontSize: 20, fontWeight: "800", color: COLORS.textDark },

  // Graph + ring
  ringWrap: {
    alignSelf: "center",
    width: 128,
    height: 128,
    marginTop: 8,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 6,
  },
  ringText: { position: "absolute", fontSize: 28, fontWeight: "800", color: COLORS.textDark },

  // Score + Insight row
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 4,
    gap: 16,
  },
  insightCol: { flex: 1 },
  insightLead: { fontSize: 14, lineHeight: 20, color: COLORS.textDark },
  bold: { fontWeight: "800" },

  miniBar: {
    marginTop: 8,
    height: 10,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 999,
    overflow: "hidden",
  },
  miniFill: {
    height: 10,
    backgroundColor: COLORS.progressFill,
    borderRadius: 999,
  },
  miniLockWrap: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  miniLabel: {
    marginTop: 6,
    color: COLORS.textSubtle,
    fontSize: 12,
    fontWeight: "600",
  },

  // Pager dots
  dotsRow: {
    position: 'absolute',
    bottom: 70,             // dots below buttons; tweak as needed
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 5, borderRadius: 3, marginHorizontal: 4, backgroundColor: "rgba(0,0,0,0.18)" },
  dotActive: { backgroundColor: COLORS.curveEnd },

  // Controls row
  controlsRow: {
    position: 'absolute',
    bottom: 110,            // move buttons up; tweak this number
    left: 0, right: 0,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  gumShadowWrap: {
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  
  gumButton: {
    backgroundColor: '#F3F6F8',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  
  gumButtonPressed: { transform: [{ translateY: 1 }] },
  gumLabel: { fontSize: 15, fontWeight: '700', color: '#0F0F0F' },
  gumBadge: {
    marginLeft: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD8D0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00FFC2', // glow color modulated by Animated shadowOpacity/radius
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  gumBadgeCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0F0F0F',
  },
});
