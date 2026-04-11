// components/branding/Direction3Preview.tsx
// Full-screen preview of "Direction 3 — Companion" branding direction.
// Light mode, warm cream palette, mascot-as-companion, narrative tone.

import React, { useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import T from "@/components/ui/T";

const { width: SW } = Dimensions.get("window");
const H_PAD = 20;

// ─── Direction 3 "Companion" color tokens ─────────────────────────────────────
const D3 = {
  bg:           "#F8F6F2",
  card:         "#FFFFFF",
  navy:         "#2D5F8A",
  navyDark:     "#1E4063",
  navyLight:    "#EAF1F8",
  amber:        "#E8A838",
  amberDark:    "#C68A18",
  amberLight:   "#FDF5E4",
  green:        "#4CAF7D",
  greenDark:    "#2E8A5B",
  greenLight:   "#E8F7EF",
  text:         "#1C2B3A",
  textSub:      "#4A6577",
  textMuted:    "#8BA0AE",
  divider:      "rgba(28,43,58,0.08)",
  shadow:       "rgba(28,43,58,0.10)",
};

// ─── Animated entrance wrapper ─────────────────────────────────────────────────
function FadeCard({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 75,
        friction: 9,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Section divider label ─────────────────────────────────────────────────────
function SectionTag({ label }: { label: string }) {
  return (
    <View style={s.sectionTagRow}>
      <View style={s.sectionTagLine} />
      <T style={s.sectionTagText}>{label}</T>
      <View style={s.sectionTagLine} />
    </View>
  );
}

// ─── 1. Mascot Greeting Card ───────────────────────────────────────────────────
function GreetingCard() {
  return (
    <FadeCard delay={0}>
      <View style={s.card}>
        {/* Mascot row */}
        <View style={s.greetRow}>
          <View style={s.avatarWrap}>
            <Image
              source={require("../../assets/sigmamax-real-updatred-logo.jpeg")}
              style={s.avatar}
            />
            {/* Online / active dot */}
            <View style={s.avatarDot} />
          </View>

          <View style={{ flex: 1 }}>
            <T style={s.greetTitle}>Good morning.</T>
            <T style={s.greetSub}>You're on a 7-day streak.</T>
          </View>

          {/* Day chip */}
          <View style={s.dayChip}>
            <T style={s.dayChipText}>Day 7</T>
          </View>
        </View>

        {/* Mascot message — speech bubble style */}
        <View style={s.bubbleWrap}>
          <View style={s.bubbleTail} />
          <View style={s.bubble}>
            <T style={s.bubbleText}>
              "7 days straight. This is how transformation starts — one day at a time."
            </T>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.navyCTA} activeOpacity={0.82}>
          <T style={s.navyCTAText}>Start Today's Session  →</T>
        </TouchableOpacity>
      </View>
    </FadeCard>
  );
}

// ─── 2. Score Ring + Streak ────────────────────────────────────────────────────
function ScoreStreakRow() {
  return (
    <FadeCard delay={80}>
      <View style={s.twoCol}>
        {/* Score card */}
        <View style={[s.card, s.colCard]}>
          <T style={s.cardEyebrow}>Facial Score</T>
          <View style={s.scoreRingWrap}>
            <View style={s.scoreRing}>
              <T style={s.scoreNumber}>82</T>
              <T style={s.scoreUnit}>/100</T>
            </View>
          </View>
          <View style={s.scoreBadge}>
            <T style={s.scoreBadgeText}>Good</T>
          </View>
          <T style={s.scoreDelta}>+4 this month</T>
        </View>

        {/* Streak card */}
        <View style={[s.card, s.colCard, { backgroundColor: D3.amberLight }]}>
          <T style={s.cardEyebrow}>Streak</T>
          <T style={s.streakFlame}>🔥</T>
          <T style={s.streakNum}>7</T>
          <T style={s.streakDaysLabel}>days</T>
          {/* Week dot track */}
          <View style={s.dotRow}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <View key={i} style={[s.weekDot, { backgroundColor: D3.amber }]}>
                <T style={s.weekDotLabel}>{d}</T>
              </View>
            ))}
          </View>
        </View>
      </View>
    </FadeCard>
  );
}

// ─── 3. Feature Progress Card ──────────────────────────────────────────────────
const FEATURES = [
  { label: "Jawline",     score: 78, delta: "+3", color: D3.navy },
  { label: "Eye Area",    score: 82, delta: "+1", color: D3.navy },
  { label: "Cheekbones",  score: 71, delta: "+2", color: D3.navy },
  { label: "Skin Quality", score: 60, delta: "—",  color: D3.textMuted },
];

function ProgressBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${score}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function FeatureProgressCard() {
  return (
    <FadeCard delay={160}>
      <View style={s.card}>
        <View style={s.featureHeader}>
          <T style={s.featureTitle}>Your Progress</T>
          <T style={s.featureWeekLabel}>This week</T>
        </View>

        {FEATURES.map((f) => (
          <View key={f.label} style={s.featureRow}>
            <T style={s.featureLabel}>{f.label}</T>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <ProgressBar score={f.score} color={f.color} />
            </View>
            <T style={s.featureScore}>{f.score}</T>
            <T style={[s.featureDelta, f.delta === "—" && { color: D3.textMuted }]}>
              {f.delta}
            </T>
          </View>
        ))}

        <View style={s.narrativeDivider} />
        <View style={s.narrativeRow}>
          <Image
            source={require("../../assets/sigmamax-real-updatred-logo.jpeg")}
            style={s.narrativeAvatar}
          />
          <T style={s.narrativeText}>
            Your jawline improved the most this week — keep doing the resistance exercises daily.
          </T>
        </View>
      </View>
    </FadeCard>
  );
}

// ─── 4. Daily Task Card ────────────────────────────────────────────────────────
function DailyTaskCard() {
  return (
    <FadeCard delay={240}>
      <View style={[s.card, s.taskCard]}>
        {/* Left navy accent bar is handled by borderLeftWidth */}
        <View style={s.taskHeader}>
          <View style={s.taskAvatarRing}>
            <Image
              source={require("../../assets/sigmamax-real-updatred-logo.jpeg")}
              style={s.taskAvatar}
            />
          </View>
          <View style={{ flex: 1 }}>
            <T style={s.taskEyebrow}>Today's Task</T>
            <T style={s.taskName}>Jawline Resistance Training</T>
          </View>
          <View style={s.taskProgressChip}>
            <T style={s.taskProgressText}>3 / 5</T>
          </View>
        </View>

        <T style={s.taskDesc}>
          Hold a towel between your teeth and apply gentle resistance with your hand. 3 sets of 20 reps, rest 30s between sets.
        </T>

        {/* Step dots */}
        <View style={s.taskDotRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.taskDot, i < 3 && s.taskDotDone]} />
          ))}
          <T style={s.taskDotCount}>3 of 5 done</T>
        </View>

        <TouchableOpacity style={s.navyCTA} activeOpacity={0.82}>
          <T style={s.navyCTAText}>Continue  →</T>
        </TouchableOpacity>
      </View>
    </FadeCard>
  );
}

// ─── 5. Score Reveal Preview ───────────────────────────────────────────────────
function ScoreRevealPreview() {
  const pulse = useRef(new Animated.Value(1)).current;
  const numAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulsing ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <FadeCard delay={320}>
      <View style={s.revealCard}>
        <T style={s.revealEyebrow}>Score Reveal Moment</T>

        {/* Ambient glow ring */}
        <View style={s.revealGlow}>
          <Animated.View style={[s.revealRing, { transform: [{ scale: pulse }] }]}>
            <T style={s.revealScore}>82</T>
            <T style={s.revealScoreUnit}>out of 100</T>
          </Animated.View>
        </View>

        <T style={s.revealCaption}>Scan complete. Your results are ready.</T>

        {/* Mascot reaction speech bubble */}
        <View style={s.revealMascotRow}>
          <Image
            source={require("../../assets/sigmamax-real-updatred-logo.jpeg")}
            style={s.revealMascot}
          />
          <View style={s.revealBubble}>
            <T style={s.revealBubbleText}>"That's growth. Keep this up."</T>
          </View>
        </View>

        {/* Score tier badges */}
        <View style={s.tierRow}>
          {[
            { label: "Needs Work", range: "< 60", active: false },
            { label: "Good",       range: "60–79", active: false },
            { label: "Great",      range: "80–89", active: true },
            { label: "Elite",      range: "90+",   active: false },
          ].map((t) => (
            <View key={t.label} style={[s.tierChip, t.active && s.tierChipActive]}>
              <T style={[s.tierLabel, t.active && s.tierLabelActive]}>{t.label}</T>
              <T style={[s.tierRange, t.active && s.tierRangeActive]}>{t.range}</T>
            </View>
          ))}
        </View>
      </View>
    </FadeCard>
  );
}

// ─── 6. Mascot Emotional States ────────────────────────────────────────────────
const EMOTIONS = [
  { label: "Greeting",       emoji: "👋", desc: "Waves in, chin raise, soft smile" },
  { label: "High Score",     emoji: "✨", desc: "Nods with approval, slight smirk" },
  { label: "Low Score",      emoji: "🎯", desc: "Steady gaze — challenge, not shame" },
  { label: "Streak",         emoji: "🔥", desc: "Amber glow badge, satisfied nod" },
  { label: "Task Complete",  emoji: "✓",  desc: "Single approving clap + green flash" },
  { label: "Idle",           emoji: "💭", desc: "Slow breathing, occasional refocus" },
  { label: "Miss Day",       emoji: "→",  desc: "Neutral. 'Let's get back to it.'" },
];

function MascotEmotionsCard() {
  return (
    <FadeCard delay={400}>
      <View style={s.card}>
        <T style={s.featureTitle}>Mascot Expression States</T>
        <T style={s.emotionsSubtitle}>
          Each interaction gets a unique reaction — building the sense of a real companion.
        </T>
        <View style={s.emotionGrid}>
          {EMOTIONS.map((e) => (
            <View key={e.label} style={s.emotionChip}>
              <T style={s.emotionEmoji}>{e.emoji}</T>
              <View style={{ flex: 1 }}>
                <T style={s.emotionLabel}>{e.label}</T>
                <T style={s.emotionDesc}>{e.desc}</T>
              </View>
            </View>
          ))}
        </View>
      </View>
    </FadeCard>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function Direction3Preview({ onClose }: { onClose: () => void }) {
  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View>
          <T style={s.topBarTitle}>Direction 3 — Companion</T>
          <T style={s.topBarSub}>Warm cream · Navy · Amber · Poppins</T>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn} activeOpacity={0.7}>
          <T style={s.closeBtnText}>✕  Close</T>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dashboard / Home ────────── */}
        <SectionTag label="Dashboard / Home" />
        <GreetingCard />
        <ScoreStreakRow />
        <FeatureProgressCard />

        {/* ── Today's Program ─────────── */}
        <SectionTag label="Today's Program" />
        <DailyTaskCard />

        {/* ── Score Reveal ────────────── */}
        <SectionTag label="Score Reveal" />
        <ScoreRevealPreview />

        {/* ── Mascot System ───────────── */}
        <SectionTag label="Mascot Expression System" />
        <MascotEmotionsCard />

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D3.bg,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingVertical: 14,
    backgroundColor: D3.card,
    borderBottomWidth: 1,
    borderBottomColor: D3.divider,
  },
  topBarTitle: {
    fontSize: 15,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.2,
  },
  topBarSub: {
    fontSize: 11,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    marginTop: 1,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: D3.navyLight,
  },
  closeBtnText: {
    fontSize: 13,
    color: D3.navy,
    fontFamily: "Poppins-SemiBold",
  },

  // Scroll
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
  },

  // Section tag
  sectionTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTagLine: {
    flex: 1,
    height: 1,
    backgroundColor: D3.divider,
  },
  sectionTagText: {
    fontSize: 10,
    color: D3.textMuted,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // Base card
  card: {
    backgroundColor: D3.card,
    borderRadius: 20,
    padding: 18,
    shadowColor: D3.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // Two-column row
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  colCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
  },

  // Card eyebrow label
  cardEyebrow: {
    fontSize: 10,
    color: D3.textMuted,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    alignSelf: "flex-start",
    marginBottom: 10,
  },

  // Greeting card
  greetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: D3.navy,
  },
  avatarDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: D3.green,
    borderWidth: 2,
    borderColor: D3.card,
  },
  greetTitle: {
    fontSize: 21,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  greetSub: {
    fontSize: 13,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: D3.navyLight,
  },
  dayChipText: {
    fontSize: 12,
    color: D3.navy,
    fontFamily: "Poppins-SemiBold",
  },

  // Speech bubble
  bubbleWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    marginLeft: 4,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    marginTop: 12,
    marginRight: -1,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: D3.navyLight,
  },
  bubble: {
    flex: 1,
    backgroundColor: D3.navyLight,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 13,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    fontStyle: "italic",
    lineHeight: 19,
  },

  // Navy CTA button
  navyCTA: {
    backgroundColor: D3.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  navyCTAText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.1,
  },

  // Score ring
  scoreRingWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  scoreRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    borderColor: D3.green,
    backgroundColor: D3.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: 26,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  scoreUnit: {
    fontSize: 10,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    lineHeight: 13,
    textAlign: "center",
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: D3.greenLight,
    marginBottom: 4,
  },
  scoreBadgeText: {
    fontSize: 12,
    color: D3.greenDark,
    fontFamily: "Poppins-SemiBold",
  },
  scoreDelta: {
    fontSize: 11,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
  },

  // Streak card
  streakFlame: {
    fontSize: 30,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  streakNum: {
    fontSize: 38,
    color: D3.amberDark,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    lineHeight: 44,
    letterSpacing: -1,
  },
  streakDaysLabel: {
    fontSize: 12,
    color: D3.amberDark,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginBottom: 10,
  },
  dotRow: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
  },
  weekDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotLabel: {
    fontSize: 8,
    color: "#FFF",
    fontFamily: "Poppins-SemiBold",
  },

  // Feature progress
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 16,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.2,
  },
  featureWeekLabel: {
    fontSize: 12,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureLabel: {
    fontSize: 13,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    width: 92,
  },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: D3.navyLight,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  featureScore: {
    fontSize: 13,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    width: 28,
    textAlign: "right",
  },
  featureDelta: {
    fontSize: 12,
    color: D3.green,
    fontFamily: "Poppins-SemiBold",
    width: 30,
    textAlign: "right",
  },
  narrativeDivider: {
    height: 1,
    backgroundColor: D3.divider,
    marginVertical: 12,
  },
  narrativeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  narrativeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: D3.navy,
  },
  narrativeText: {
    flex: 1,
    fontSize: 13,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    fontStyle: "italic",
    lineHeight: 19,
  },

  // Daily task card
  taskCard: {
    borderLeftWidth: 3,
    borderLeftColor: D3.navy,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  taskAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: D3.navy,
    overflow: "hidden",
  },
  taskAvatar: {
    width: "100%",
    height: "100%",
  },
  taskEyebrow: {
    fontSize: 10,
    color: D3.textMuted,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  taskName: {
    fontSize: 15,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.2,
  },
  taskProgressChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: D3.navyLight,
  },
  taskProgressText: {
    fontSize: 12,
    color: D3.navy,
    fontFamily: "Poppins-SemiBold",
  },
  taskDesc: {
    fontSize: 13,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    lineHeight: 19,
    marginBottom: 14,
  },
  taskDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D3.divider,
  },
  taskDotDone: {
    backgroundColor: D3.navy,
  },
  taskDotCount: {
    fontSize: 12,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    marginLeft: 4,
  },

  // Score reveal
  revealCard: {
    backgroundColor: D3.navyLight,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: D3.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  revealEyebrow: {
    fontSize: 10,
    color: D3.textMuted,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  revealGlow: {
    shadowColor: D3.green,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: 16,
  },
  revealRing: {
    width: 134,
    height: 134,
    borderRadius: 67,
    borderWidth: 6,
    borderColor: D3.green,
    backgroundColor: D3.card,
    alignItems: "center",
    justifyContent: "center",
  },
  revealScore: {
    fontSize: 52,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 58,
    letterSpacing: -2,
  },
  revealScoreUnit: {
    fontSize: 11,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
  },
  revealCaption: {
    fontSize: 14,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginBottom: 20,
  },
  revealMascotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    marginBottom: 20,
  },
  revealMascot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: D3.navy,
  },
  revealBubble: {
    flex: 1,
    backgroundColor: D3.card,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  revealBubbleText: {
    fontSize: 13,
    color: D3.textSub,
    fontFamily: "Poppins-Regular",
    fontStyle: "italic",
    lineHeight: 18,
  },
  // Score tier row
  tierRow: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "stretch",
  },
  tierChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(28,43,58,0.06)",
  },
  tierChipActive: {
    backgroundColor: D3.navy,
  },
  tierLabel: {
    fontSize: 10,
    color: D3.textSub,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },
  tierLabelActive: {
    color: "#FFFFFF",
  },
  tierRange: {
    fontSize: 9,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    marginTop: 1,
  },
  tierRangeActive: {
    color: "rgba(255,255,255,0.7)",
  },

  // Mascot emotions
  emotionsSubtitle: {
    fontSize: 12,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 14,
  },
  emotionGrid: {
    gap: 8,
  },
  emotionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: D3.bg,
    borderRadius: 12,
  },
  emotionEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
    fontFamily: "Poppins-Regular",
  },
  emotionLabel: {
    fontSize: 13,
    color: D3.text,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.1,
  },
  emotionDesc: {
    fontSize: 12,
    color: D3.textMuted,
    fontFamily: "Poppins-Regular",
    marginTop: 1,
    lineHeight: 16,
  },
});
