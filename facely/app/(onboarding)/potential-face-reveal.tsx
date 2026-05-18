// app/(onboarding)/potential-face-reveal.tsx
// First post-purchase hero moment: reveal the user's generated potential face.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { ChevronRight, Maximize2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";
import { labelForMetric } from "@/lib/potentialFaceLabels";
import { usePotentialFace, type PotentialFace } from "@/store/potentialFace";
import { useScores } from "@/store/scores";

const FONT = "ProximaNova-Bold";

const CHIP = {
  bg: "#E2F1D8",
  border: "#C7E2B4",
  text: "#1F3D1F",
};

const REVEAL_POLL_TIMEOUT_MS = 180_000;
const SLOW_WAIT_HINT_MS = 45_000;

export default function PotentialFaceRevealScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const data = usePotentialFace((s) => s.data);
  const error = usePotentialFace((s) => s.error);
  const isPolling = usePotentialFace((s) => s.isPolling);
  const load = usePotentialFace((s) => s.load);
  const pollUntilReady = usePotentialFace((s) => s.pollUntilReady);
  const stopPolling = usePotentialFace((s) => s.stopPolling);
  const retryGeneration = usePotentialFace((s) => s.retryGeneration);
  const markRevealSeen = usePotentialFace((s) => s.markRevealSeen);
  const currentImageUri = useScores((s) => s.imageUri);

  const [slowWait, setSlowWait] = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowWait(true);
    }, SLOW_WAIT_HINT_MS);

    (async () => {
      const fresh = await load();
      if (cancelled) return;

      if (fresh?.status === "unlocked") {
        goBridge();
        return;
      }

      if (fresh?.status === "pending" || !fresh) {
        const settled = await pollUntilReady(REVEAL_POLL_TIMEOUT_MS);
        if (cancelled) return;
        if (!settled || settled.status === "pending") setPollExhausted(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBridge = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const current = usePotentialFace.getState().data;
    const isDevPreview = __DEV__ && !!current?.id?.startsWith("dev-potential-face");
    router.replace(
      isDevPreview
        ? { pathname: "/(onboarding)/analysis-intro", params: { devPreview: "1" } }
        : "/(onboarding)/analysis-intro"
    );
  }, []);

  const acknowledgeReveal = useCallback(() => {
    markRevealSeen();
    hapticSuccess();
    goBridge();
  }, [goBridge, markRevealSeen]);

  const onPressRetry = useCallback(async () => {
    if (swapping) return;
    setSwapping(true);
    setSlowWait(false);
    setPollExhausted(false);
    hapticLight();
    const slowTimer = setTimeout(() => setSlowWait(true), SLOW_WAIT_HINT_MS);
    try {
      const current = usePotentialFace.getState().data;
      if (!current?.baselineScanId) {
        throw new Error("Potential face scan is not available.");
      }
      await retryGeneration(current.baselineScanId);
      const settled = await pollUntilReady(REVEAL_POLL_TIMEOUT_MS);
      if (!settled || settled.status === "pending") setPollExhausted(true);
    } catch (err: any) {
      const message = String(err?.message ?? "");
      Alert.alert(
        "Couldn't retry image",
        message.includes("weekly_quota_exceeded") || message.includes("429")
          ? "You've used both potential face generations for this week."
          : "Please try again in a moment."
      );
    } finally {
      clearTimeout(slowTimer);
      setSwapping(false);
    }
  }, [pollUntilReady, retryGeneration, swapping]);

  const isReady = data?.status === "ready";
  const showFallback = data?.status === "failed";

  if (showFallback) {
    return (
      <FallbackView
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        reason={data?.errorReason ?? error}
        onContinue={() => {
          hapticSuccess();
          goBridge();
        }}
      />
    );
  }

  if (!isReady) {
    return (
      <PolishingView
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        polling={isPolling}
        error={error}
        slow={slowWait || pollExhausted}
        exhausted={pollExhausted}
        onContinue={() => {
          hapticSuccess();
          goBridge();
        }}
      />
    );
  }

  return (
    <RevealView
      insetsTop={insets.top}
      insetsBottom={insets.bottom}
      screenWidth={width}
      potentialFace={data}
      currentImageUri={currentImageUri}
      onPrimary={acknowledgeReveal}
      onRetry={onPressRetry}
      swapping={swapping}
    />
  );
}

function PolishingView({
  insetsTop,
  insetsBottom,
  polling,
  error,
  slow,
  exhausted,
  onContinue,
}: {
  insetsTop: number;
  insetsBottom: number;
  polling: boolean;
  error: string | null;
  slow: boolean;
  exhausted: boolean;
  onContinue: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.centerScrollContent,
        {
          paddingTop: insetsTop + SP[5],
          paddingBottom: insetsBottom + SP[5],
          paddingHorizontal: SP[5],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.centerColumn}>
        <ActivityIndicator color={COLORS.lightText} size="large" />
        <Animated.View entering={FadeIn.duration(360).delay(120)}>
          <T style={styles.polishingTitle}>Polishing your potential face</T>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(360).delay(220)}>
          <T style={styles.polishingSubtitle}>
            {slow
              ? "This can take a couple of minutes. You can keep this screen open, or continue to your breakdown while it finishes."
              : polling
              ? "The image model is still working. Keep this screen open for the first reveal."
              : error ?? "One moment..."}
          </T>
        </Animated.View>
        {slow ? (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.polishingAction}>
            <PrimaryPill
              label="NEXT"
              onPress={onContinue}
            />
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function FallbackView({
  insetsTop,
  insetsBottom,
  reason,
  onContinue,
}: {
  insetsTop: number;
  insetsBottom: number;
  reason: string | null;
  onContinue: () => void;
}) {
  const quotaBlocked = !!reason && reason.includes("weekly_quota_exceeded");
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.centerScrollContent,
        {
          paddingTop: insetsTop + SP[5],
          paddingBottom: insetsBottom + SP[5],
          paddingHorizontal: SP[5],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.fallbackCenter}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.fallbackInner}>
          <T style={styles.eyebrow}>POTENTIAL FACE</T>
          <T style={styles.fallbackTitle}>
            {quotaBlocked ? "Your weekly generations are used" : "We'll have it ready soon"}
          </T>
          <T style={styles.fallbackBody}>
            {quotaBlocked
              ? "You can still continue into your breakdown and start the plan today."
              : "Your breakdown is ready to continue. The image can finish in the background or be retried later."}
          </T>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.duration(380).delay(120)}>
        <PrimaryPill label="NEXT" onPress={onContinue} />
      </Animated.View>
    </ScrollView>
  );
}

function RevealView({
  insetsTop,
  insetsBottom,
  screenWidth,
  potentialFace,
  currentImageUri,
  onPrimary,
  onRetry,
  swapping,
}: {
  insetsTop: number;
  insetsBottom: number;
  screenWidth: number;
  potentialFace: PotentialFace;
  currentImageUri: string | null | undefined;
  onPrimary: () => void;
  onRetry: () => void;
  swapping: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const horizontalPad = SP[5];
  const heroWidth = Math.min(screenWidth - horizontalPad * 2, ms(356));
  const heroHeight = Math.round(heroWidth * 1.18);
  const thumbWidth = Math.min(ms(92), Math.round(heroWidth * 0.28));

  const improvements = useMemo(() => {
    const mapped = potentialFace.targetedMetrics.map(labelForMetric);
    return mapped.length
      ? mapped
      : ["Sharper structure", "Cleaner skin", "More defined features"];
  }, [potentialFace.targetedMetrics]);

  const remaining = potentialFace.weeklyQuota?.remaining;
  const canRetry = !swapping && (remaining == null ? potentialFace.regeneratedCount === 0 : remaining > 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.revealScrollContent,
        {
          paddingTop: insetsTop + SP[4],
          paddingBottom: insetsBottom + SP[4],
          paddingHorizontal: horizontalPad,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(380)} style={styles.header}>
        <T style={styles.eyebrow}>YOUR POTENTIAL FACE</T>
        <T style={styles.title}>This is the version you're building toward</T>
        <T style={styles.subtitle}>Generated from your scan, with identity preserved.</T>
      </Animated.View>

      <HeroPotentialCard
        width={heroWidth}
        height={heroHeight}
        thumbWidth={thumbWidth}
        potentialUri={potentialFace.primaryImageUrl}
        currentUri={currentImageUri}
        onPress={() => setPreviewOpen(true)}
      />

      <Animated.View entering={FadeInUp.duration(360).delay(480)} style={styles.improvementsBlock}>
        <T style={styles.improvementsLabel}>WHAT CHANGED</T>
        <View style={styles.chipRow}>
          {improvements.map((label, idx) => (
            <Animated.View
              key={`${label}-${idx}`}
              entering={FadeInUp.duration(300).delay(560 + idx * 55)}
              style={styles.chip}
            >
              <View style={styles.chipDot} />
              <T style={styles.chipText}>{label}</T>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Animated.View entering={FadeInDown.duration(360).delay(760)}>
          <PrimaryPill label="NEXT" onPress={onPrimary} withChevron />
        </Animated.View>
        {canRetry ? (
          <Pressable
            onPress={onRetry}
            disabled={swapping}
            accessibilityRole="button"
            accessibilityLabel="Retry potential face image"
            style={({ pressed }) => [styles.secondary, pressed && !swapping && { opacity: 0.65 }]}
            hitSlop={8}
          >
            {swapping ? (
              <ActivityIndicator color={COLORS.lightSub} />
            ) : (
              <T style={styles.secondaryText}>This doesn't look like me</T>
            )}
          </Pressable>
        ) : (
          <View style={styles.secondaryPlaceholder} />
        )}
      </View>

      <ImagePreviewModal
        visible={previewOpen}
        uri={potentialFace.primaryImageUrl}
        onClose={() => setPreviewOpen(false)}
      />
    </ScrollView>
  );
}

function HeroPotentialCard({
  width,
  height,
  thumbWidth,
  potentialUri,
  currentUri,
  onPress,
}: {
  width: number;
  height: number;
  thumbWidth: number;
  potentialUri: string | null;
  currentUri: string | null | undefined;
  onPress: () => void;
}) {
  const progress = useSharedValue(0);
  const thumb = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 18, stiffness: 110, mass: 0.9 });
    thumb.value = withDelay(
      420,
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, thumb]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 230 },
      { rotate: `${(1 - progress.value) * -7}deg` },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: thumb.value,
    transform: [{ translateY: (1 - thumb.value) * 12 }],
  }));

  return (
    <View style={[styles.heroWrap, { width, height }]}>
      <Pressable
        onPress={onPress}
        disabled={!potentialUri}
        accessibilityRole="imagebutton"
        accessibilityLabel="Open full potential face image"
        style={({ pressed }) => [pressed && potentialUri && { opacity: 0.96 }]}
      >
        <Animated.View style={[styles.heroCard, { width, height }, cardStyle]}>
          {potentialUri ? (
            <Image source={{ uri: potentialUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.imagePlaceholder]} />
          )}
          <View style={styles.heroScrim} />
          <View style={styles.heroLabel}>
            <T style={styles.heroLabelText}>YOUR POTENTIAL</T>
          </View>
          <View style={styles.expandBadge}>
            <Maximize2 size={ms(14)} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[
          styles.todayThumb,
          {
            width: thumbWidth,
            height: Math.round(thumbWidth * 1.25),
            right: SP[4],
            bottom: SP[4],
          },
          thumbStyle,
        ]}
      >
        {currentUri ? (
          <Image source={{ uri: currentUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.imagePlaceholder]} />
        )}
        <View style={styles.thumbLabel}>
          <T style={styles.thumbLabelText}>TODAY</T>
        </View>
      </Animated.View>
    </View>
  );
}

function ImagePreviewModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <SafeAreaView style={styles.previewSafe}>
          <View style={styles.previewHeader}>
            <T style={styles.previewTitle}>Potential face</T>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close full image"
              hitSlop={12}
              style={({ pressed }) => [styles.previewClose, pressed && { opacity: 0.72 }]}
            >
              <X size={ms(20)} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={styles.previewImageWrap}>
            {uri ? (
              <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function PrimaryPill({
  label,
  onPress,
  withChevron = false,
}: {
  label: string;
  onPress: () => void;
  withChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.primaryPill, pressed && { opacity: 0.92 }]}
    >
      <T style={styles.primaryPillText}>{label.toUpperCase()}</T>
      {withChevron && <ChevronRight size={ms(16)} color="#FFFFFF" strokeWidth={2.5} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  centerScrollContent: {
    flexGrow: 1,
  },
  revealScrollContent: {
    flexGrow: 1,
  },
  header: {
    gap: sh(4),
    marginBottom: SP[3],
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.accentDepth,
    letterSpacing: 1.6,
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(25),
    color: COLORS.lightText,
    lineHeight: ms(28),
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    lineHeight: ms(16),
  },
  heroWrap: {
    alignSelf: "center",
    justifyContent: "center",
  },
  heroCard: {
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  heroLabel: {
    position: "absolute",
    top: SP[3],
    left: SP[3],
    paddingHorizontal: SP[3],
    paddingVertical: sh(6),
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  heroLabelText: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  expandBadge: {
    position: "absolute",
    top: SP[3],
    right: SP[3],
    width: ms(32),
    height: ms(32),
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
  },
  todayThumb: {
    position: "absolute",
    borderRadius: RADII.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: COLORS.lightSurfaceAlt,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  thumbLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingVertical: sh(5),
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  thumbLabelText: {
    fontFamily: FONT,
    fontSize: ms(9),
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  improvementsBlock: {
    marginTop: SP[4],
    gap: sh(10),
  },
  improvementsLabel: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightMuted,
    letterSpacing: 1.4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: sw(7),
    rowGap: sh(8),
  },
  chip: {
    minHeight: sh(34),
    paddingLeft: sw(8),
    paddingRight: sw(10),
    paddingVertical: sh(7),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP.border,
    backgroundColor: CHIP.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: sw(5),
  },
  chipDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: 999,
    backgroundColor: COLORS.accentDepth,
  },
  chipText: {
    fontFamily: FONT,
    fontSize: ms(11.5, 0.2),
    color: CHIP.text,
    letterSpacing: 0,
  },
  footer: {
    marginTop: "auto",
    gap: sh(10),
  },
  primaryPill: {
    minHeight: sh(56),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingVertical: sh(16),
    paddingHorizontal: sw(20),
  },
  primaryPillText: {
    fontFamily: FONT,
    fontSize: ms(15, 0.3),
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  secondary: {
    alignSelf: "center",
    minHeight: sh(30),
    justifyContent: "center",
    paddingHorizontal: SP[3],
  },
  secondaryText: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    letterSpacing: 0,
  },
  secondaryPlaceholder: {
    height: sh(34),
  },
  centerColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(16),
  },
  polishingTitle: {
    fontFamily: FONT,
    fontSize: ms(20),
    color: COLORS.lightText,
    textAlign: "center",
  },
  polishingSubtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
    maxWidth: ms(280),
    lineHeight: ms(18),
  },
  polishingAction: {
    width: "100%",
    marginTop: sh(10),
  },
  fallbackCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackInner: {
    alignItems: "center",
    gap: sh(8),
    maxWidth: ms(310),
  },
  fallbackTitle: {
    fontFamily: FONT,
    fontSize: ms(24),
    color: COLORS.lightText,
    textAlign: "center",
    lineHeight: ms(28),
    letterSpacing: 0,
  },
  fallbackBody: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
    lineHeight: ms(18),
    marginTop: sh(4),
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  previewSafe: {
    flex: 1,
  },
  previewHeader: {
    minHeight: sh(58),
    paddingHorizontal: SP[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  previewClose: {
    width: ms(42),
    height: ms(42),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImageWrap: {
    flex: 1,
    paddingHorizontal: SP[3],
    paddingBottom: SP[5],
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});
