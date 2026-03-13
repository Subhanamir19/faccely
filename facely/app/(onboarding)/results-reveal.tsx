// app/(onboarding)/results-reveal.tsx
// Pre-paywall screen: shows before/after comparison, tier, metrics, social proof.
import React, { useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Lock,
  Zap,
  Sun,
  Moon,
  BookOpen,
  Scan,
  ChevronDown,
  ChevronUp,
  Trophy,
  TrendingUp,
  BarChart2,
  Lightbulb,
  Check,
} from "lucide-react-native";
import { useScores, type Scores } from "@/store/scores";
import { COLORS } from "@/lib/tokens";
import LimeButton from "@/components/ui/LimeButton";

const { width: SW } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getTier(score: number): string {
  if (score <= 30) return "Low Tier Normie";
  if (score <= 59) return "Mid Tier Normie";
  if (score <= 70) return "High Tier Normie";
  if (score <= 80) return "Chad Lite";
  if (score <= 90) return "Chad";
  return "True Adam";
}

function calcOverall(scores: Scores): number {
  const vals = [
    scores.jawline,
    scores.facial_symmetry,
    scores.skin_quality,
    scores.cheekbones,
    scores.eyes_symmetry,
    scores.nose_harmony,
    scores.sexual_dimorphism,
  ];
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

const METRIC_LABELS: Record<keyof Scores, string> = {
  jawline: "Chin & Jaw",
  cheekbones: "Cheekbones",
  facial_symmetry: "Symmetry",
  skin_quality: "Skin",
  eyes_symmetry: "Eye Area",
  nose_harmony: "Nose",
  sexual_dimorphism: "Definition",
};

const METRIC_ICONS: Record<keyof Scores, string> = {
  jawline: "△",
  cheekbones: "◇",
  facial_symmetry: "⟺",
  skin_quality: "○",
  eyes_symmetry: "◉",
  nose_harmony: "▽",
  sexual_dimorphism: "✦",
};

function getLowest2(scores: Scores) {
  return (Object.entries(scores) as [keyof Scores, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([key, score]) => ({ key, label: METRIC_LABELS[key], icon: METRIC_ICONS[key], score }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Before/After Slider
// ─────────────────────────────────────────────────────────────────────────────
const COMPARE_H = 340;

function BeforeAfterSlider({
  imageUri,
  overallScore,
  afterScore,
}: {
  imageUri: string | null;
  overallScore: number;
  afterScore: number;
}) {
  const dividerX = useRef(new RNAnimated.Value(SW / 2)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        dividerX.setValue(Math.max(52, Math.min(SW - 52, evt.nativeEvent.pageX)));
      },
    })
  ).current;

  const Placeholder = ({ blur }: { blur?: boolean }) => (
    <LinearGradient
      colors={blur ? ["#1a2a3a", "#0d1520"] : ["#2a2a2a", "#1a1a1a"]}
      style={{ width: SW, height: COMPARE_H }}
    />
  );

  return (
    <View style={{ width: SW, height: COMPARE_H, overflow: "hidden" }}>
      {/* Right: blurred AFTER */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: SW, height: COMPARE_H }} resizeMode="cover" blurRadius={14} />
      ) : (
        <Placeholder blur />
      )}

      {/* Left: sharp BEFORE */}
      <RNAnimated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: dividerX, overflow: "hidden" }}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: SW, height: COMPARE_H }} resizeMode="cover" />
        ) : (
          <Placeholder />
        )}
      </RNAnimated.View>

      {/* Divider line */}
      <RNAnimated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.88)", left: dividerX, transform: [{ translateX: -1 }] }}
      />

      {/* Handle */}
      <RNAnimated.View
        {...panResponder.panHandlers}
        style={{ position: "absolute", top: 0, bottom: 0, width: 52, left: dividerX, transform: [{ translateX: -26 }], justifyContent: "center", alignItems: "center" }}
      >
        <View style={sl.handle}>
          <Text style={sl.handleText}>{"<>"}</Text>
        </View>
      </RNAnimated.View>

      {/* BEFORE badge */}
      <View style={sl.beforeBadge} pointerEvents="none">
        <Text style={sl.badgeLabel}>BEFORE</Text>
        <Text style={sl.beforeScore}>{overallScore}<Text style={sl.scoreDenom}>/100</Text></Text>
      </View>

      {/* AFTER badge */}
      <View style={sl.afterBadge} pointerEvents="none">
        <Text style={sl.afterLabel}>AFTER</Text>
        <Text style={sl.afterScore}>{afterScore}<Text style={sl.afterDenom}>/100</Text></Text>
      </View>

      {/* Lock */}
      <View style={sl.lockWrap} pointerEvents="none">
        <Lock size={28} color="rgba(255,255,255,0.85)" />
      </View>

      <LinearGradient colors={["transparent", "rgba(11,11,11,0.8)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 100 }} pointerEvents="none" />
    </View>
  );
}

const sl = StyleSheet.create({
  handle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.95)", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 8 },
  handleText: { fontSize: 13, color: "#111", fontFamily: "Poppins-SemiBold", letterSpacing: -1 },
  beforeBadge: { position: "absolute", top: 16, left: 14, backgroundColor: "rgba(18,18,18,0.85)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  badgeLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontFamily: "Poppins-SemiBold", letterSpacing: 1.2 },
  beforeScore: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 26, lineHeight: 31, marginTop: 1 },
  scoreDenom: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  afterBadge: { position: "absolute", top: 16, right: 14, backgroundColor: "rgba(91,162,255,0.18)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(91,162,255,0.4)" },
  afterLabel: { color: "rgba(91,190,255,0.75)", fontSize: 10, fontFamily: "Poppins-SemiBold", letterSpacing: 1.2 },
  afterScore: { color: "#5BBFFF", fontFamily: "Poppins-SemiBold", fontSize: 26, lineHeight: 31, marginTop: 1 },
  afterDenom: { fontSize: 13, color: "rgba(91,190,255,0.5)" },
  lockWrap: { position: "absolute", right: SW * 0.25 - 24, top: COMPARE_H / 2 - 24, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
});

// ─────────────────────────────────────────────────────────────────────────────
// How It Works Carousel
// ─────────────────────────────────────────────────────────────────────────────
const STEP_BLUE = "#4A9EFF";
const CARD_W = SW - 48;

function HowItWorksCarousel({ area1, area2, currentTier, afterTier }: { area1: string; area2: string; currentTier: string; afterTier: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const steps = [
    { when: "RIGHT NOW", title: "Access your custom routine", subtitle: `Exercises targeting ${area1} & ${area2}, ready to go`, Icon: Zap },
    { when: "DAY 1",     title: "Start your morning routine",          subtitle: "5–10 min of targeted facial exercises per day",              Icon: Sun },
    { when: "WEEK 1",    title: "Complete your first progress scan",   subtitle: "Track measurable changes with 3D facial analysis",           Icon: BarChart2 },
    { when: "WEEK 4",    title: "Watch your score climb",              subtitle: "Real data confirming your facial development",               Icon: TrendingUp },
    { when: "WEEK 12",   title: "Reach your transformation goal",      subtitle: `From ${currentTier} to ${afterTier}`,                       Icon: Trophy },
  ];

  return (
    <View>
      <FlatList
        data={steps}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
        onMomentumScrollEnd={(e) => setActiveIdx(Math.max(0, Math.min(steps.length - 1, Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 12)))))}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={cr.card}>
            <View style={cr.numCircle}><Text style={cr.numText}>{index + 1}</Text></View>
            <View style={cr.cardBody}>
              <Text style={cr.when}>{item.when}</Text>
              <Text style={cr.title} numberOfLines={1}>{item.title}</Text>
              <Text style={cr.subtitle} numberOfLines={2}>{item.subtitle}</Text>
            </View>
            <item.Icon size={20} color={STEP_BLUE} />
          </View>
        )}
      />
      <View style={cr.dots}>
        {steps.map((_, i) => <View key={i} style={[cr.dot, i === activeIdx ? cr.dotActive : cr.dotInactive]} />)}
      </View>
    </View>
  );
}

const cr = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: "#161616", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  numCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(74,158,255,0.15)", justifyContent: "center", alignItems: "center" },
  numText: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 16 },
  cardBody: { flex: 1 },
  when: { color: STEP_BLUE, fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  title: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 15, marginTop: 2 },
  subtitle: { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins-Regular", fontSize: 12, lineHeight: 17, marginTop: 3 },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 12, gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: "#fff" },
  dotInactive: { width: 6, backgroundColor: "rgba(255,255,255,0.25)" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Unlock Grid
// ─────────────────────────────────────────────────────────────────────────────
const GRID_ITEMS = [
  { title: "Morning Routine",     subtitle: "Targeted exercises for your weakest areas",     Icon: Sun },
  { title: "Evening Routine",     subtitle: "Recovery & muscle development exercises",        Icon: Moon },
  { title: "Personalized Course", subtitle: "36 lessons tailored to your face structure",    Icon: BookOpen },
  { title: "Daily Progress Scan", subtitle: "Track real changes with 3D analysis",           Icon: Scan },
];

function UnlockGrid() {
  const tileW = (SW - 48 - 12) / 2;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {GRID_ITEMS.map((item, i) => (
        <View key={i} style={[gr.tile, { width: tileW }]}>
          <View style={gr.iconCircle}><item.Icon size={22} color="#fff" /></View>
          <Text style={gr.tileTitle}>{item.title}</Text>
          <Text style={gr.tileSub}>{item.subtitle}</Text>
        </View>
      ))}
    </View>
  );
}

const gr = StyleSheet.create({
  tile: { backgroundColor: "#161616", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(58,84,180,0.35)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  tileTitle: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 14, lineHeight: 18 },
  tileSub: { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins-Regular", fontSize: 12, lineHeight: 17, marginTop: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Testimonials
// ─────────────────────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  { name: "Mason Monroe", stars: 5, text: "\"Seeing my score go up each week keeps me motivated. I've improved 14 points in 2 months.\"" },
  { name: "Jake T.",      stars: 5, text: '"The routine is legit. My jaw definition improved noticeably in 6 weeks."' },
  { name: "Ethan R.",     stars: 5, text: '"Best investment for my appearance. The daily scans keep you accountable."' },
  { name: "Alex M.",      stars: 5, text: '"Went from 44 to 67 in 3 months. The personalized approach makes all the difference."' },
];

function TestimonialCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);
  const TW = SW - 48;
  return (
    <View>
      <FlatList
        data={TESTIMONIALS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={TW}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => setActiveIdx(Math.max(0, Math.min(TESTIMONIALS.length - 1, Math.round(e.nativeEvent.contentOffset.x / TW))))}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={{ width: TW }}>
            <View style={tm.card}>
              <View style={tm.avatar}><Text style={{ fontSize: 20 }}>👤</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={tm.name}>{item.name}</Text>
                  <Text style={tm.stars}>{"★".repeat(item.stars)}</Text>
                </View>
                <Text style={tm.quote}>{item.text}</Text>
              </View>
            </View>
          </View>
        )}
      />
      <View style={tm.dots}>
        {TESTIMONIALS.map((_, i) => <View key={i} style={[tm.dot, i === activeIdx ? tm.dotActive : tm.dotInactive]} />)}
      </View>
    </View>
  );
}

const tm = StyleSheet.create({
  card: { backgroundColor: "#1C1C1C", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 18, flexDirection: "row", gap: 14, alignItems: "flex-start" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  name: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  stars: { color: "#FFB800", fontSize: 13 },
  quote: { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins-Regular", fontSize: 13, lineHeight: 19, marginTop: 6 },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#fff" },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.25)" },
});

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────
const FAQ_DATA = [
  { q: "I don't know what to improve",       a: "FaceKit's AI pinpoints your weakest areas automatically. After your scan, you'll see exactly what to focus on with a personalized routine built around your unique face structure.", Icon: Lightbulb },
  { q: "What if this doesn't work for me?",  a: "Results vary by individual, but our program is designed for measurable progress. The 3D scan tracking lets you see real changes — most users notice visible improvements within 4–6 weeks.", Icon: Lock },
  { q: "How long until I see results?",      a: "Most members see measurable score improvements within 2–4 weeks of consistent practice. Significant transformations typically happen at the 8–12 week mark.", Icon: TrendingUp },
  { q: "Is it safe?",                        a: "Yes. All exercises are based on established facial muscle training principles. No tools or invasive methods — just targeted exercises you do at home.", Icon: Check },
];

function FAQItem({ q, a, Icon }: { q: string; a: string; Icon: React.ComponentType<any> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={fq.wrap}>
      <Pressable style={fq.row} onPress={() => setOpen(!open)}>
        <View style={fq.iconWrap}><Icon size={16} color="rgba(255,255,255,0.7)" /></View>
        <Text style={fq.question}>{q}</Text>
        {open ? <ChevronUp size={18} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.4)" />}
      </Pressable>
      {open && <Text style={fq.answer}>{a}</Text>}
    </View>
  );
}

const fq = StyleSheet.create({
  wrap: { borderRadius: 14, backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(58,84,180,0.22)", justifyContent: "center", alignItems: "center" },
  question: { flex: 1, color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  answer: { color: "rgba(255,255,255,0.55)", fontFamily: "Poppins-Regular", fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ResultsRevealScreen() {
  const insets = useSafeAreaInsets();
  const { scores, imageUri } = useScores();
  const [socialCount, setSocialCount] = useState(Math.floor(Math.random() * 40) + 382);

  const overallScore = scores ? calcOverall(scores) : 0;
  const afterScore   = Math.min(100, overallScore + 30);
  const currentTier  = getTier(overallScore);
  const afterTier    = getTier(afterScore);
  const lowest2      = scores ? getLowest2(scores) : null;
  const area1        = lowest2?.[0]?.label ?? "Chin & Jaw";
  const area2        = lowest2?.[1]?.label ?? "Cheekbones";

  // Social proof ticker
  useEffect(() => {
    const id = setInterval(() => {
      setSocialCount((p) => Math.max(370, Math.min(420, p + (Math.random() > 0.5 ? 1 : -1))));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0B" }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>

        {/* ① Before/After slider */}
        <BeforeAfterSlider imageUri={imageUri} overallScore={overallScore} afterScore={afterScore} />

        {/* ② Tier pill */}
        <View style={s.section}>
          <View style={s.tierPill}>
            <View>
              <Text style={s.tierNowLabel}>NOW</Text>
              <Text style={s.tierCurrent}>{currentTier}</Text>
            </View>
            <Text style={s.tierArrow}>→</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.tierWeeksLabel}>12 WEEKS</Text>
              <Text style={s.tierAfter}>{afterTier}</Text>
            </View>
          </View>
        </View>

        {/* ③ What We'll Fix */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>What We'll Fix Based on Your Scan</Text>
          <View style={s.metricRow}>
            {lowest2 ? (
              lowest2.map((m) => (
                <View key={m.key} style={s.metricPill}>
                  <Text style={s.metricIcon}>{m.icon}</Text>
                  <Text style={s.metricLabel}>{m.label}</Text>
                  <Text style={s.metricScore}> {m.score}/100</Text>
                </View>
              ))
            ) : (
              <>
                <View style={s.metricPill}><Text style={s.metricIcon}>△</Text><Text style={s.metricLabel}>Chin & Jaw</Text></View>
                <View style={s.metricPill}><Text style={s.metricIcon}>◇</Text><Text style={s.metricLabel}>Cheekbones</Text></View>
              </>
            )}
          </View>
          <View style={s.infoPill}>
            <Text style={s.infoPillText}>35,000+ Faces Looksmaxxed With FaceKit</Text>
          </View>
        </View>

        {/* ④ How It Works */}
        <View style={s.sectionNoPad}>
          <Text style={[s.sectionTitle, { paddingHorizontal: 24 }]}>Here's Exactly What Happens Next</Text>
          <View style={{ marginTop: 14 }}>
            <HowItWorksCarousel area1={area1} area2={area2} currentTier={currentTier} afterTier={afterTier} />
          </View>
        </View>

        {/* ⑤ Unlock grid */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>This Is What You'll Unlock Today</Text>
          <View style={{ marginTop: 14 }}><UnlockGrid /></View>
          <View style={[s.infoPill, { marginTop: 14 }]}>
            <Text style={s.infoPillText}>⏱  Just 5–10 min per day — fits your schedule perfectly</Text>
          </View>
        </View>

        {/* ⑥ App Store rating */}
        <View style={[s.section, { alignItems: "center" }]}>
          <View style={s.ratingBadge}>
            <Text style={{ fontSize: 22 }}>🅐</Text>
            <Text style={s.ratingText}>4.8★  App Store Rating</Text>
          </View>
        </View>

        {/* ⑦ Transform + testimonials */}
        <View style={s.section}>
          <View style={s.transformCard}>
            <Text style={s.transformTitle}>Watch yourself transform</Text>
            {[
              ["Weekly 3D scans",   " to measure real change over time"],
              ["Track ",            "score improvements",   " across every category"],
              ["Side-by-side ",     "before & after",       " comparisons"],
            ].map((parts, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletCheck}>✓</Text>
                <Text style={s.bulletText}>
                  {parts.map((part, j) =>
                    j % 2 === 1
                      ? <Text key={j} style={{ fontFamily: "Poppins-SemiBold", color: "#fff" }}>{part}</Text>
                      : <Text key={j}>{part}</Text>
                  )}
                </Text>
              </View>
            ))}
            <View style={{ marginTop: 20 }}><TestimonialCarousel /></View>
          </View>
        </View>

        {/* ⑧ FAQ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
          <View style={{ marginTop: 14 }}>
            {FAQ_DATA.map((item) => <FAQItem key={item.q} q={item.q} a={item.a} Icon={item.Icon} />)}
          </View>
        </View>

      </ScrollView>

      {/* Sticky CTA */}
      <View style={[s.stickyBottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <LinearGradient colors={["transparent", "rgba(11,11,11,0.97)", "#0B0B0B"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={s.stickyInner}>
          <View style={s.socialRow}>
            <View style={s.greenDot} />
            <Text style={s.socialText}>
              <Text style={s.socialCount}>{socialCount} users</Text>
              {" started their ascension in the last hour"}
            </Text>
          </View>
          <View style={{ width: "88%", alignSelf: "center" }}>
            <LimeButton label="Start Ascending Today" onPress={() => router.push("/(onboarding)/score-projection")} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  section:      { paddingHorizontal: 24, paddingTop: 28 },
  sectionNoPad: { paddingTop: 28 },
  sectionTitle: { fontFamily: "Poppins-SemiBold", fontSize: 20, lineHeight: 26, color: "#fff" },

  tierPill:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#161616", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, paddingVertical: 14 },
  tierNowLabel:   { color: "rgba(255,255,255,0.4)", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  tierCurrent:    { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 16 },
  tierArrow:      { color: "rgba(255,255,255,0.35)", fontSize: 20 },
  tierWeeksLabel: { color: COLORS.accent, fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  tierAfter:      { color: COLORS.accent, fontFamily: "Poppins-SemiBold", fontSize: 16 },

  metricRow:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  metricPill:  { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A1A", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 14, paddingVertical: 10 },
  metricIcon:  { color: "rgba(255,255,255,0.55)", fontSize: 14, marginRight: 7 },
  metricLabel: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  metricScore: { color: "rgba(255,255,255,0.45)", fontFamily: "Poppins-Regular", fontSize: 13 },

  infoPill:     { backgroundColor: "#1A1A1A", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", paddingHorizontal: 16, paddingVertical: 11, alignItems: "center" },
  infoPillText: { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins-Regular", fontSize: 13 },

  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#1A1A1A", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, paddingVertical: 12 },
  ratingText:  { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 15 },

  transformCard:  { backgroundColor: "#161616", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 20 },
  transformTitle: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 18, marginBottom: 14 },
  bulletRow:      { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  bulletCheck:    { color: COLORS.accent, fontFamily: "Poppins-SemiBold", fontSize: 15, marginTop: 1 },
  bulletText:     { flex: 1, color: "rgba(255,255,255,0.7)", fontFamily: "Poppins-Regular", fontSize: 14, lineHeight: 20 },

  stickyBottom: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 36 },
  stickyInner:  { gap: 12 },
  socialRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  greenDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  socialText:   { color: "rgba(255,255,255,0.65)", fontFamily: "Poppins-Regular", fontSize: 13 },
  socialCount:  { color: "#fff", fontFamily: "Poppins-SemiBold" },
});
