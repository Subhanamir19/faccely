// C:\SS\facely\app\(tabs)\take-picture.tsx
import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  Alert,
  Pressable,
  Modal,
  StatusBar,
  SafeAreaView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import StreakIcon from "@/assets/icons/streak-icon.svg";
import HistoryIcon from "@/assets/icons/history-icon.svg";
import RecoveryCodeHint from "@/components/ui/RecoveryCodeHint";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

// NEW: shared pre-upload compressor (JPEG, max 1080px)
import { ensureJpegCompressed } from "../../lib/api/media";
import { logger } from '@/lib/logger';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/store/auth";
import { getWeekScanData, checkScanLimit, WEEKLY_SCAN_LIMIT } from "@/lib/supabase/scanLimit";
import { getNextMonday } from "@/lib/time/nextMidnight";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import {
  APP_SCREEN_BG,
  AppGradientBackground,
} from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { useTasksStore } from "@/store/tasks";

// Soft drop-shadow recipe shared by all elevated surfaces — same recipe used
// across dashboard, routine list, workout preview.
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;

// Shared DIN Rounded Bold face loaded once by the app root.
const FONT = "DINNextRounded-Bold";

const SCAN_FONT_MEDIUM = "Fredoka-Medium";
const SCAN_FONT_SEMIBOLD = "Fredoka-SemiBold";
const SCAN_FONT_BOLD = "Fredoka-Bold";
const SCAN_ORANGE = "#FA7E03";
const SCAN_INK = "#15130F";
const SCAN_MUTED = "#6E685F";
const SCAN_FAINT = "#A29C93";
const SCAN_SURFACE = "#F4F3F1";
const SCAN_CALLOUT_SCALE = 0.92;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ScanHeroGeometry = {
  width: number;
  height: number;
  cardX: number;
  cardY: number;
  cardWidth: number;
  cardHeight: number;
  scale: number;
};

type CalloutConfig = {
  key: "grooming" | "structure" | "skin";
  label: string;
  target: number;
  icon: ImageSourcePropType;
  landmarkX: number;
  landmarkY: number;
  pillY: number;
  side: "left" | "right";
  delayMs: number;
  pillWidth: number;
  iconSize: number;
  iconLeft: number;
  iconTop: number;
};

const SCAN_CALLOUTS: CalloutConfig[] = [
  {
    key: "grooming",
    label: "GROOMING",
    target: 7,
    icon: require("../../assets/icons/GROOMING.png"),
    landmarkX: 0.37,
    landmarkY: 0.345,
    pillY: 0.09,
    side: "left",
    delayMs: 750,
    pillWidth: 128,
    iconSize: 70,
    iconLeft: -21,
    iconTop: -21,
  },
  {
    key: "structure",
    label: "STRUCTURE",
    target: 8,
    icon: require("../../assets/icons/STRUCTURE-ICON.png"),
    landmarkX: 0.32,
    landmarkY: 0.5,
    pillY: 0.8,
    side: "left",
    delayMs: 1450,
    pillWidth: 128,
    iconSize: 64,
    iconLeft: -18,
    iconTop: -17,
  },
  {
    key: "skin",
    label: "SKIN",
    target: 3,
    icon: require("../../assets/icons/SKIN-ICON.png"),
    landmarkX: 0.64,
    landmarkY: 0.48,
    pillY: 0.42,
    side: "right",
    delayMs: 2150,
    pillWidth: 126,
    iconSize: 83,
    iconLeft: -28,
    iconTop: -28,
  },
];

function triggerScanButtonHaptic() {
  if (Platform.OS === "android") {
    return Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
  }
  if (Platform.OS === "ios") {
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  }
  return Promise.resolve();
}

function triggerScanControlHaptic() {
  if (Platform.OS === 'android') {
    return Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick);
  }
  if (Platform.OS === 'ios') {
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  return Promise.resolve();
}

function ScanFrameIcon({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
        stroke="#FAF9F7"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.4} stroke="#FAF9F7" strokeWidth={1.9} />
    </Svg>
  );
}

function ScanPrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPressIn={() => {
        if (!disabled) void triggerScanButtonHaptic();
      }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.scanPrimaryButton,
        disabled && styles.scanPrimaryButtonDisabled,
        pressed && !disabled && styles.scanCtaPressed,
      ]}
      accessibilityRole={'button'}
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
    >
      {!disabled && (
        <LinearGradient
          pointerEvents={'none'}
          colors={['#2B2B2E', '#0A0A0B', '#0A0A0B']}
          locations={[0, 0.6, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.scanCtaGradient}
        />
      )}
      {icon}
      <Text style={[styles.scanPrimaryButtonText, disabled && styles.scanPrimaryButtonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScanStepHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.scanStepHeading}>
      <View style={styles.scanEyebrowRow}>
        <View style={styles.scanEyebrowDot} />
        <Text style={styles.scanEyebrow}>{eyebrow}</Text>
        <View style={styles.scanEyebrowDot} />
      </View>
      <Text style={styles.scanStepTitle}>{title}</Text>
    </View>
  );
}

function ScanMetricCallout({
  config,
  geometry,
  reduceMotion,
}: {
  config: CalloutConfig;
  geometry: ScanHeroGeometry;
  reduceMotion: boolean;
}) {
  const lineProgress = useSharedValue(reduceMotion ? 1 : 0);
  const dotProgress = useSharedValue(reduceMotion ? 1 : 0);
  const ringProgress = useSharedValue(0);
  const pillProgress = useSharedValue(reduceMotion ? 1 : 0);
  const [count, setCount] = useState(reduceMotion ? config.target : 0);

  const calloutScale = geometry.scale * SCAN_CALLOUT_SCALE;
  const pillWidth = config.pillWidth * calloutScale;
  const pillHeight = 50 * calloutScale;
  const sideInset = geometry.width * 0.035;
  const anchorX = geometry.cardX + geometry.cardWidth * config.landmarkX;
  const anchorY = geometry.cardY + geometry.cardHeight * config.landmarkY;
  const pillCenterX =
    config.side === "left"
      ? sideInset + pillWidth / 2
      : geometry.width - sideInset - pillWidth / 2;
  const pillCenterY = geometry.height * config.pillY;
  // Preserve the reference's under-card line treatment for the two left
  // callouts. Skin alone terminates at the near edge so its short connector
  // cannot disappear beneath the pill.
  const connectorX =
    config.key === "skin" ? pillCenterX - pillWidth / 2 : pillCenterX;
  const elbowX = anchorX + (connectorX - anchorX) * 0.32;
  const elbowY = anchorY;
  const pathLength =
    Math.abs(elbowX - anchorX) +
    Math.hypot(connectorX - elbowX, pillCenterY - elbowY);

  useEffect(() => {
    cancelAnimation(lineProgress);
    cancelAnimation(dotProgress);
    cancelAnimation(ringProgress);
    cancelAnimation(pillProgress);

    if (reduceMotion) {
      lineProgress.value = 1;
      dotProgress.value = 1;
      ringProgress.value = 0;
      pillProgress.value = 1;
      setCount(config.target);
      return;
    }

    lineProgress.value = 0;
    dotProgress.value = 0;
    ringProgress.value = 0;
    pillProgress.value = 0;
    setCount(0);

    lineProgress.value = withDelay(
      config.delayMs,
      withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.4, 0.1, 0.3, 1),
      }),
    );
    dotProgress.value = withDelay(
      config.delayMs,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    pillProgress.value = withDelay(
      config.delayMs + 550,
      withTiming(1, {
        duration: 550,
        easing: Easing.bezier(0.3, 1.6, 0.5, 1),
      }),
    );
    ringProgress.value = withDelay(
      config.delayMs + 50,
      withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );

    const timer = setTimeout(() => {
      setCount(config.target);
    }, config.delayMs + 550);

    return () => {
      clearTimeout(timer);
      cancelAnimation(lineProgress);
      cancelAnimation(dotProgress);
      cancelAnimation(ringProgress);
      cancelAnimation(pillProgress);
    };
  }, [config.delayMs, config.target, dotProgress, lineProgress, pillProgress, reduceMotion, ringProgress]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - lineProgress.value),
  }));
  const dotProps = useAnimatedProps(() => ({ opacity: dotProgress.value }));
  const ringProps = useAnimatedProps(() => ({
    opacity: reduceMotion
      ? 0.65
      : interpolate(ringProgress.value, [0, 0.7, 1], [0.9, 0, 0]),
    r: reduceMotion ? 7 : 7 * interpolate(ringProgress.value, [0, 1], [0.3, 2.6]),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillProgress.value,
    transform: [{ scale: interpolate(pillProgress.value, [0, 1], [0.35, 1]) }],
  }));

  return (
    <>
      <Svg
        pointerEvents="none"
        width={geometry.width}
        height={geometry.height}
        style={StyleSheet.absoluteFill}
      >
        <AnimatedPath
          d={`M ${anchorX} ${anchorY} L ${elbowX} ${elbowY} L ${connectorX} ${pillCenterY}`}
          fill="none"
          stroke={SCAN_ORANGE}
          strokeWidth={1.7 * geometry.scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${pathLength} ${pathLength}`}
          animatedProps={lineProps}
          opacity={0.9}
        />
        <AnimatedCircle
          cx={anchorX}
          cy={anchorY}
          r={7}
          fill="none"
          stroke={SCAN_ORANGE}
          strokeWidth={1.4 * geometry.scale}
          animatedProps={ringProps}
        />
        <AnimatedCircle
          cx={anchorX}
          cy={anchorY}
          r={3.6 * geometry.scale}
          fill={SCAN_ORANGE}
          animatedProps={dotProps}
        />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.metricPill,
          {
            left: pillCenterX - pillWidth / 2,
            top: pillCenterY - pillHeight / 2,
            width: pillWidth,
            minHeight: pillHeight,
            borderRadius: 16 * calloutScale,
            paddingVertical: 7 * calloutScale,
            paddingLeft: 7 * calloutScale,
            paddingRight: 10 * calloutScale,
            gap: 8 * calloutScale,
          },
          pillStyle,
        ]}
      >
        <View
          style={[
            styles.metricIconViewport,
            {
              width: 28 * calloutScale,
              height: 28 * calloutScale,
            },
          ]}
        >
          <Image
            source={config.icon}
            style={{
              position: "absolute",
              width: config.iconSize * calloutScale,
              height: config.iconSize * calloutScale,
              left: config.iconLeft * calloutScale,
              top: config.iconTop * calloutScale,
            }}
            resizeMode="contain"
          />
        </View>
        <View style={styles.metricCopy}>
          <Text
            numberOfLines={1}
            style={[
              styles.metricEyebrow,
              {
                fontSize: 9 * calloutScale,
                lineHeight: 11 * calloutScale,
                letterSpacing: 1.2 * calloutScale,
              },
            ]}
          >
            {config.label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.metricValue,
              {
                fontSize: 14 * calloutScale,
                lineHeight: 17 * calloutScale,
              },
            ]}
          >
            {count}+ Metrics
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

function ScanHero() {
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const sweepProgress = useSharedValue(0);

  const geometry = useMemo<ScanHeroGeometry>(() => {
    const width = layout.width;
    const height = layout.height;
    const scale = Math.min(1.08, Math.max(0.86, width / 350));
    const preferredCardWidth = width * 0.83;
    const heightLimitedCardWidth = Math.max(0, height * 0.82 * 0.75);
    const cardWidth = Math.min(preferredCardWidth, heightLimitedCardWidth);
    const cardHeight = cardWidth * (4 / 3);

    return {
      width,
      height,
      cardX: (width - cardWidth) / 2,
      cardY: height * 0.035,
      cardWidth,
      cardHeight,
      scale,
    };
  }, [layout.height, layout.width]);

  useEffect(() => {
    cancelAnimation(sweepProgress);
    sweepProgress.value = 0;
    if (reduceMotion || geometry.cardHeight <= 0) return;

    sweepProgress.value = withDelay(
      2400,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
          }),
          withDelay(1800, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );

    return () => cancelAnimation(sweepProgress);
  }, [geometry.cardHeight, reduceMotion, sweepProgress]);

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1,
    transform: [
      {
        translateY: interpolate(
          sweepProgress.value,
          [0, 1],
          [-geometry.cardHeight * 0.36, geometry.cardHeight],
        ),
      },
    ],
  }));

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((current) =>
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height },
    );
  }, []);

  return (
    <View style={styles.scanHero} onLayout={handleLayout}>
      {geometry.cardWidth > 0 && (
        <>
          <View
            style={[
              styles.faceCard,
              {
                left: geometry.cardX,
                top: geometry.cardY,
                width: geometry.cardWidth,
                height: geometry.cardHeight,
                borderRadius: 28 * geometry.scale,
              },
            ]}
          >
            <View style={[styles.faceClip, { borderRadius: 28 * geometry.scale }]}>
              <Image
                source={require("../../assets/capture-guides/frontal-guide-vector.jpg")}
                style={styles.facePortrait}
                resizeMode="cover"
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scanSweepBand,
                  { height: geometry.cardHeight * 0.34 },
                  sweepStyle,
                ]}
              >
                <LinearGradient
                  colors={[
                    "rgba(250,126,3,0)",
                    "rgba(250,126,3,0.14)",
                    "rgba(250,126,3,0.30)",
                    "rgba(250,126,3,0.14)",
                    "rgba(250,126,3,0)",
                  ]}
                  locations={[0, 0.45, 0.5, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]}
                locations={[0, 1]}
                style={styles.faceBottomFade}
              />
            </View>
          </View>

          {SCAN_CALLOUTS.map((config) => (
            <ScanMetricCallout
              key={config.key}
              config={config}
              geometry={geometry}
              reduceMotion={reduceMotion}
            />
          ))}
        </>
      )}
    </View>
  );
}

function ScanIntroScreen({
  onHistory,
  onScan,
}: {
  onHistory: () => void;
  onScan: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const currentStreak = useTasksStore((state) => state.currentStreak);
  const reduceMotion = useReducedMotion();
  const ctaPulse = useSharedValue(0);
  const compact = windowHeight < 720;

  useEffect(() => {
    cancelAnimation(ctaPulse);
    ctaPulse.value = 0;
    if (reduceMotion) return;
    ctaPulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    );
    return () => cancelAnimation(ctaPulse);
  }, [ctaPulse, reduceMotion]);

  const ctaRingStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(ctaPulse.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(ctaPulse.value, [0, 1], [1, 1.09]) }],
  }));

  return (
    <View style={styles.scanScreen}>
      <StatusBar barStyle="dark-content" backgroundColor={APP_SCREEN_BG} />
      <SafeAreaView style={styles.scanSafeArea}>
        <View style={styles.scanContent}>
          <View style={[styles.scanTopBar, compact && styles.scanTopBarCompact]}>
            <View style={styles.streakPill} accessibilityLabel={`${currentStreak} day streak`}>
              <StreakIcon width={20} height={20} />
              <Text style={styles.streakNumber}>{currentStreak}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onHistory();
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.historyButton, pressed && styles.scanControlPressed]}
              accessibilityRole="button"
              accessibilityLabel="Scan history"
            >
              <HistoryIcon width={20} height={20} />
            </Pressable>
          </View>

          <View style={[styles.scanIntroCopy, compact && styles.scanIntroCopyCompact]}>
            <View style={styles.scanEyebrowRow}>
              <View style={styles.scanEyebrowDot} />
              <Text style={styles.scanEyebrow}>FACE SCAN</Text>
              <View style={styles.scanEyebrowDot} />
            </View>
            <Text style={styles.scanTitle}>3 signals, one face.</Text>
          </View>

          <ScanHero />

          <Text style={styles.scanFootnote}>Takes 10 seconds · stays on your device</Text>

          <View style={[styles.scanCtaWrap, compact && styles.scanCtaWrapCompact]}>
            <Pressable
              onPressIn={() => {
                void triggerScanButtonHaptic();
              }}
              onPress={onScan}
              hitSlop={8}
              style={({ pressed }) => [styles.scanCta, pressed && styles.scanCtaPressed]}
              accessibilityRole="button"
              accessibilityLabel="Scan my face"
            >
              <Animated.View pointerEvents="none" style={[styles.scanCtaPulseRing, ctaRingStyle]} />
              <LinearGradient
                pointerEvents="none"
                colors={["#2B2B2E", "#0A0A0B", "#0A0A0B"]}
                locations={[0, 0.6, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.scanCtaGradient}
              />
              <ScanFrameIcon />
              <Text style={styles.scanCtaText}>Scan My Face</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ============================== HELPERS ============================== */
function toFileUri(u: string) {
  if (u.startsWith("file://") || u.startsWith("http")) return u;
  if (u.startsWith("/")) return `file://${u}`;
  return u;
}

/** Normalize any incoming URI to a stable file:// path we can read. */
async function ensureFileUriAsync(raw?: string | null): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("content://")) {
    // Copy out of content resolver so we get a readable file:// path
    const dest = `${FileSystem.cacheDirectory}capture_${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: raw, to: dest });
      return dest;
    } catch {
      // Fallback: let RN/Expo try to read content:// directly later
      return raw;
    }
  }
  return toFileUri(raw);
}

function toUserFacingMessage(err: unknown, fallback = "Network or file error") {
  if (err instanceof Error && err.message) return err.message;
  const msg = String((err as any)?.message ?? err ?? "").trim();
  return msg || fallback;
}

type Step = "intro" | "capture" | "review";

/* ============================== SCREEN ============================== */
export default function TakePicture() {
  const [perm, requestPerm] = useCameraPermissions();
  const permissionDenied = perm?.granted === false;


  const [step, setStep] = useState<Step>("intro");
  const [pose, setPose] = useState<"frontal" | "side">("frontal");
  const [frontalUri, setFrontalUri] = useState<string | null>(null);
  const [sideUri, setSideUri] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("front");
  const cameraRef = useRef<CameraView>(null);
  // Prevents concurrent handleChosen calls (e.g. double-tap gallery)
  const handlingRef = useRef(false);


  // Normalize URI and advance to the next step.
  // handlingRef prevents concurrent invocations (e.g. rapid gallery double-tap).
  const handleChosen = useCallback(async (uri: string | null) => {
    if (!uri || handlingRef.current) return;
    handlingRef.current = true;
    try {
      const normalized = await ensureFileUriAsync(uri);
      if (!normalized) throw new Error("Bad photo path");
      if (pose === "frontal") {
        setFrontalUri(normalized);
        if (sideUri) {
          // Retaking frontal only — side already exists, return to review
          setStep("review");
        } else {
          setPose("side");
          setStep("capture");
        }
      } else {
        setSideUri(normalized);
        setStep("review");
      }
    } catch (e) {
      logger.error("[PIC] normalize failed", e);
      Alert.alert("File error", "Could not use the selected photo.");
    } finally {
      handlingRef.current = false;
    }
  }, [pose, sideUri]);

  const changePose = useCallback((nextPose: "frontal" | "side") => {
    setPose(nextPose);
    setStep("capture");
    setChooserOpen(true);
  }, []);

  const pickFromGallery = useCallback(async () => {
    setChooserOpen(false);
    setCameraOpen(false);
    // On Android, the camera modal needs a moment to fully dismiss before the
    // system image picker can open correctly — without this, it can silently fail.
    if (Platform.OS === "android") {
      await new Promise<void>((r) => setTimeout(r, 300));
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) await handleChosen(res.assets?.[0]?.uri ?? null);
  }, [handleChosen]);

  const startCamera = useCallback(async () => {
    setChooserOpen(false);
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) {
        Alert.alert("Permission needed", "Camera permission is required.");
        return;
      }
    }
    setCameraOpen(true);
  }, [perm, requestPerm]);

  const capture = useCallback(async () => {
    // Guard against double-tap on the shutter button
    if (capturing) return;
    setCapturing(true);
    try {
      const cam: any = cameraRef.current;
      const photo =
        (await cam?.takePictureAsync?.({ quality: 1, skipProcessing: false })) ||
        (await cam?.takePhoto?.({ quality: 1 })) ||
        null;
      const raw = photo?.uri ?? photo?.path ?? photo?.assets?.[0]?.uri;
      // Close camera immediately after the photo is taken so the UI
      // snaps back without waiting for URI normalization.
      setCameraOpen(false);
      await handleChosen(raw ?? null);
    } catch {
      setCameraOpen(false);
      Alert.alert("Camera error", "Something went wrong. Please try again.");
    } finally {
      setCapturing(false);
    }
  }, [capturing, handleChosen]);

  const canContinue = !!frontalUri && !!sideUri && !submitting;

  const beginScan = async () => {
    const bypass = await AsyncStorage.getItem("dev_bypass_scan_limit");
    if (__DEV__ && bypass === "true") {
      logger.log("[scanLimit] dev bypass active — skipping check");
    } else {
      const uid = useAuthStore.getState().uid;
      if (uid) {
        logger.log("[scanLimit] checking limit for user:", uid);
        const { lastScanTime, weekCount } = await getWeekScanData(uid);
        const { allowed, reason } = checkScanLimit(lastScanTime, weekCount);
        logger.log(
          "[scanLimit] last scan:",
          lastScanTime?.toISOString() ?? "none",
          "| scans this week:", weekCount,
          "| limit:", WEEKLY_SCAN_LIMIT
        );
        logger.log("[scanLimit] allowed:", allowed, "| reason:", reason ?? "n/a");
        if (!allowed) {
          if (reason === "weekly") {
            const next = getNextMonday();
            const dateStr = next.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
            Alert.alert(
              "Weekly Limit Reached",
              `You've used both scans for this week. Your next scan is available ${dateStr}.`,
              [{ text: "OK" }]
            );
          } else {
            Alert.alert(
              "Daily Limit Reached",
              "You've already scanned today. Come back tomorrow.",
              [{ text: "OK" }]
            );
          }
          return;
        }
      }
    }

    setFrontalUri(null);
    setSideUri(null);
    setPose("frontal");
    setStep("capture");
  };

  const goToHistory = () => {
    router.push("/history" as any);
  };

  const useBoth = async () => {
    logger.log("[PIC] Proceed tapped", { frontalUri, sideUri });
    if (!canContinue) {
      logger.warn("[PIC] blocked: canContinue=false", { frontalUri, sideUri, submitting });
      return;
    }

    setSubmitting(true);

    try {
      // URIs are already normalized by handleChosen — no need to re-resolve.
      let fNormTemp, sNormTemp;
      try {
        [fNormTemp, sNormTemp] = await Promise.all([
          ensureJpegCompressed(frontalUri!),
          ensureJpegCompressed(sideUri!),
        ]);
      } catch {
        throw new Error(
          "Couldn't load one of your photos. Please retake or pick a different image."
        );
      }
      const [fNorm, sNorm] = await Promise.all([
        persistCompressedResult(fNormTemp),
        persistCompressedResult(sNormTemp),
      ]);

      router.push({
        pathname: "/loading",
        params: {
          mode: "analyzePair",
          phase: "scoring",
          front: encodeURIComponent(fNorm.uri),
          side: encodeURIComponent(sNorm.uri),
          // pass meta so loading can skip reprocessing
          frontName: fNorm.name,
          sideName: sNorm.name,
          frontMime: "image/jpeg",
          sideMime: "image/jpeg",
          normalized: "1",
        },
      });
    } catch (err) {
      logger.error("[PIC] proceed failed", err);
      Alert.alert("Couldn't proceed", toUserFacingMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelCamera = () => {
    void triggerScanControlHaptic();
    if (frontalUri) {
      Alert.alert(
        'Cancel scan?',
        'Your frontal photo will be lost and you will need to start over.',
        [
          { text: 'Keep scanning', style: 'cancel' },
          {
            text: 'Cancel scan',
            style: 'destructive',
            onPress: () => {
              setCameraOpen(false);
              setStep('intro');
              setFrontalUri(null);
              setSideUri(null);
              setPose('frontal');
            },
          },
        ],
      );
      return;
    }
    setCameraOpen(false);
  };

  const renderIntro = () => (
    <ScanIntroScreen
      onHistory={goToHistory}
      onScan={beginScan}
    />
  );

  const renderLegacyGuide = ({
    guideSrc,
    title,
    overlay,
  }: {
    guideSrc: any;
    title: string;
    overlay: "frontal" | "side";
  }) => (
    <AppGradientBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP[5] }}>
          <Text
            style={{
              color: COLORS.lightText,
              fontFamily: FONT,
              fontSize: ms(24),
              lineHeight: ms(28),
              letterSpacing: -0.4,
              marginBottom: sh(16),
              textAlign: "center",
            }}
          >
            {title}
          </Text>

          {/* Guide image — dim-white card with soft shadow */}
          <View
            style={{
              width: "86%",
              aspectRatio: 3 / 4,
              borderRadius: RADII.lg,
              overflow: "hidden",
              backgroundColor: COLORS.lightCard,
              ...SOFT_SHADOW,
            }}
          >
            <Image source={guideSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>

          <Text
            style={{
              marginTop: sh(14),
              color: COLORS.lightSub,
              fontFamily: FONT,
              fontSize: ms(13),
              lineHeight: ms(18),
              textAlign: "center",
            }}
          >
            Align your face with the guides. Good lighting, neutral expression.
          </Text>

          {/* Black CTA */}
          <View style={{ marginTop: sh(20), paddingHorizontal: SP[6], alignSelf: "stretch" }}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); void startCamera(); }}
              style={({ pressed }) => ({
                minHeight: sh(56),
                borderRadius: 999,
                backgroundColor: COLORS.ctaBlack,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: sh(16),
                paddingHorizontal: SP[6],
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: "#FFFFFF", fontFamily: FONT, fontSize: ms(15), letterSpacing: 0.6, textAlign: "center" }}>
                CAPTURE PHOTO
              </Text>
            </Pressable>
          </View>

          {/* Step dots — dark filled / hairline empty */}
          <View style={{ flexDirection: "row", gap: 6, marginTop: sh(14) }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: overlay === "frontal" ? COLORS.ctaBlack : COLORS.lightBorder,
              }}
            />
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: overlay === "side" ? COLORS.ctaBlack : COLORS.lightBorder,
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </AppGradientBackground>
  );

  const renderGuide = ({
    guideSrc,
    title,
    overlay,
  }: {
    guideSrc: ImageSourcePropType;
    title: string;
    overlay: 'frontal' | 'side';
  }) => (
    <View style={styles.scanScreen}>
      <StatusBar barStyle={'dark-content'} backgroundColor={APP_SCREEN_BG} />
      <SafeAreaView style={styles.scanSafeArea}>
        <View style={styles.scanGuidedContent}>
          <ScanStepHeading
            eyebrow={overlay === 'frontal' ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}
            title={title}
          />

          <View style={styles.scanGuideHero}>
            <View style={styles.scanGuideCard}>
              <Image source={guideSrc} style={styles.scanGuideImage} resizeMode={'cover'} />
            </View>
          </View>

          <View style={styles.scanGuideCaptionRow}>
            <View style={styles.scanGuideCaptionDot} />
            <Text style={styles.scanGuideCaption}>
              Good lighting, neutral expression, face aligned with the guide.
            </Text>
          </View>

          <View style={styles.scanGuideFooter}>
            <View
              style={styles.scanStepDots}
              accessibilityLabel={`${overlay === 'frontal' ? 1 : 2} of 2`}
            >
              <View style={[styles.scanStepDot, overlay === 'frontal' && styles.scanStepDotActive]} />
              <View style={[styles.scanStepDot, overlay === 'side' && styles.scanStepDotActive]} />
            </View>
            <ScanPrimaryButton
              label={'Open Camera'}
              onPress={() => void startCamera()}
              icon={<ScanFrameIcon />}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );

  const renderReview = () => (
    <View style={styles.scanScreen}>
      <StatusBar barStyle={'dark-content'} backgroundColor={APP_SCREEN_BG} />
      <SafeAreaView style={styles.scanSafeArea}>
        <View style={styles.scanGuidedContent}>
          <ScanStepHeading eyebrow={'PHOTOS READY'} title={'Review your photos'} />

          <View style={styles.scanReviewGrid}>
            {[
              { label: 'FRONTAL', uri: frontalUri, retake: () => changePose('frontal') },
              { label: 'SIDE', uri: sideUri, retake: () => changePose('side') },
            ].map(({ label, uri, retake }) => (
              <View key={label} style={styles.scanReviewItem}>
                <Text style={styles.scanReviewLabel}>{label}</Text>
                <View style={styles.scanReviewCard}>
                  <Image source={{ uri: uri! }} style={styles.scanReviewImage} resizeMode={'cover'} />
                </View>
                <Pressable
                  onPressIn={() => void triggerScanControlHaptic()}
                  onPress={retake}
                  hitSlop={8}
                  style={({ pressed }) => [styles.scanSecondaryButton, pressed && styles.scanControlPressed]}
                  accessibilityRole={'button'}
                  accessibilityLabel={`Retake ${label.toLowerCase()} photo`}
                >
                  <Text style={styles.scanSecondaryButtonText}>Retake</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.scanReviewHint}>
            <View style={styles.scanGuideCaptionDot} />
            <Text style={styles.scanGuideCaption}>Clear, well-lit photos give the most accurate scan.</Text>
          </View>

          <View style={styles.scanReviewFooter}>
            <ScanPrimaryButton
              label={submitting ? 'Analyzing…' : 'Analyze Photos'}
              onPress={() => void useBoth()}
              disabled={!canContinue}
            />
            <Pressable
              onPressIn={() => void triggerScanControlHaptic()}
              onPress={() => {
                setFrontalUri(null);
                setSideUri(null);
                setPose('frontal');
                setStep('intro');
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.scanStartOverButton, pressed && styles.scanControlPressed]}
              accessibilityRole={'button'}
            >
              <Text style={styles.scanStartOverText}>Start over</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );

  return (
    <>
      <RecoveryCodeHint />
      {step === "intro" && renderIntro()}
      {step === "capture" &&
        renderGuide({
          guideSrc:
            pose === "frontal"
              ? require("../../assets/capture-guides/frontal-guide-vector.jpg")
              : require("../../assets/capture-guides/side-guy-vector.jpg"),
          title: pose === "frontal" ? "Take Frontal Photo" : "Take Side Photo",
          overlay: pose,
        })}

      {step === "review" && renderReview()}

      {false && step === "review" && (
        <AppGradientBackground>
          <StatusBar barStyle="dark-content" />
          <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP[5] }}>
            <Text
              style={{
                color: COLORS.lightText,
                fontFamily: FONT,
                fontSize: ms(22),
                lineHeight: ms(26),
                letterSpacing: -0.4,
                marginBottom: sh(14),
              }}
            >
              Review your photos
            </Text>

            <View style={{ width: "92%", flexDirection: "row", justifyContent: "space-between", gap: SP[3] }}>
              {[
                { label: "FRONTAL", uri: frontalUri, retake: () => changePose("frontal") },
                { label: "SIDE",    uri: sideUri,    retake: () => changePose("side") },
              ].map(({ label, uri, retake }) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.lightSub, fontFamily: FONT, fontSize: ms(11), letterSpacing: 0.6, marginBottom: 6 }}>
                    {label}
                  </Text>
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 3 / 4,
                      borderRadius: RADII.md,
                      overflow: "hidden",
                      backgroundColor: COLORS.lightCard,
                      ...SOFT_SHADOW,
                    }}
                  >
                    <Image source={{ uri: uri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <Pressable
                    onPress={retake}
                    style={({ pressed }) => ({
                      marginTop: sh(10),
                      alignSelf: "flex-start",
                      backgroundColor: COLORS.lightSurfaceAlt,
                      paddingHorizontal: sw(14),
                      paddingVertical: sh(8),
                      borderRadius: 999,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: COLORS.lightText, fontFamily: FONT, fontSize: ms(12), letterSpacing: 0.4 }}>
                      RETAKE
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Black analyze CTA */}
            <View style={{ marginTop: sh(24), paddingHorizontal: SP[6], alignSelf: "stretch" }}>
              <Pressable
                onPress={useBoth}
                disabled={!canContinue}
                style={({ pressed }) => ({
                  minHeight: sh(56),
                  borderRadius: 999,
                  backgroundColor: canContinue ? COLORS.ctaBlack : COLORS.lightSurfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: sh(16),
                  paddingHorizontal: SP[6],
                  opacity: pressed && canContinue ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: canContinue ? "#FFFFFF" : COLORS.lightSub,
                    fontFamily: FONT,
                    fontSize: ms(15),
                    letterSpacing: 0.6,
                    textAlign: "center",
                  }}
                >
                  {submitting ? "ANALYZING…" : "ANALYZE PHOTOS"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => { setFrontalUri(null); setSideUri(null); setPose("frontal"); setStep("intro"); }}
              style={{ marginTop: sh(16) }}
            >
              <Text style={{ color: COLORS.lightSub, fontSize: ms(13), fontFamily: FONT, textAlign: "center" }}>
                Start over
              </Text>
            </Pressable>
          </SafeAreaView>
        </AppGradientBackground>
      )}

      {/* Chooser — bottom sheet matching the Edit/Targets sheets */}
      <Modal
        visible={chooserOpen}
        transparent
        statusBarTranslucent
        animationType={'fade'}
        onRequestClose={() => setChooserOpen(false)}
      >
        <View style={styles.scanSheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setChooserOpen(false)}
            accessibilityRole={'button'}
            accessibilityLabel={'Close photo options'}
          />
          <SafeAreaView style={styles.scanSheetSafeArea}>
            <View style={styles.scanSheet}>
              <View style={styles.scanSheetHandle} />
              <Text style={styles.scanSheetTitle}>Add a photo</Text>
              <Text style={styles.scanSheetBody}>Use the camera or choose from your library.</Text>
              <ScanPrimaryButton
                label={'Take Photo'}
                onPress={() => void startCamera()}
                icon={<ScanFrameIcon />}
              />
              <Pressable
                onPressIn={() => void triggerScanControlHaptic()}
                onPress={() => void pickFromGallery()}
                style={({ pressed }) => [styles.scanSheetSecondaryButton, pressed && styles.scanControlPressed]}
                accessibilityRole={'button'}
              >
                <Text style={styles.scanSheetSecondaryText}>Choose from Library</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={false && chooserOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setChooserOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setChooserOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close photo options"
          />
          <View
            style={{
              backgroundColor: COLORS.lightBg,
              borderTopLeftRadius: RADII.card,
              borderTopRightRadius: RADII.card,
              paddingHorizontal: SP[5],
              paddingTop: SP[3],
              paddingBottom: SP[6],
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: sw(44),
                height: sh(4),
                borderRadius: 999,
                backgroundColor: COLORS.lightBorder,
                marginBottom: SP[4],
              }}
            />
            <Text style={{ fontFamily: FONT, fontSize: ms(22), color: COLORS.lightText, letterSpacing: -0.4 }}>
              Add a photo
            </Text>
            <Text style={{ fontFamily: FONT, fontSize: ms(13), color: COLORS.lightSub, marginTop: sh(4), marginBottom: SP[5] }}>
              Use the camera or pick from your library
            </Text>

            {/* Primary — black pill */}
            <Pressable
              onPress={startCamera}
              style={({ pressed }) => ({
                minHeight: sh(56),
                borderRadius: 999,
                backgroundColor: COLORS.ctaBlack,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: sh(16),
                paddingHorizontal: SP[6],
                opacity: pressed ? 0.9 : 1,
                marginBottom: SP[3],
              })}
            >
              <Text style={{ color: "#FFFFFF", fontFamily: FONT, fontSize: ms(15), letterSpacing: 0.6 }}>
                TAKE PHOTO
              </Text>
            </Pressable>

            {/* Secondary — light pill */}
            <Pressable
              onPress={pickFromGallery}
              style={({ pressed }) => ({
                minHeight: sh(56),
                borderRadius: 999,
                backgroundColor: COLORS.lightSurfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: sh(16),
                paddingHorizontal: SP[6],
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: COLORS.lightText, fontFamily: FONT, fontSize: ms(15), letterSpacing: 0.6 }}>
                PICK FROM GALLERY
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Camera modal */}
      <Modal
        visible={cameraOpen}
        animationType={'fade'}
        presentationStyle={'fullScreen'}
        onRequestClose={cancelCamera}
      >
        <StatusBar hidden />
        <View style={styles.scanCamera}>
          {permissionDenied ? (
            <SafeAreaView style={styles.scanCameraPermissionSafeArea}>
              <View style={styles.scanCameraPermissionContent}>
                <View style={styles.scanCameraPermissionIcon}>
                  <ScanFrameIcon size={24} />
                </View>
                <Text style={styles.scanCameraPermissionTitle}>Camera access needed</Text>
                <Text style={styles.scanCameraPermissionBody}>
                  Allow camera access to capture the two photos used for your scan.
                </Text>
                <Pressable
                  onPressIn={() => void triggerScanButtonHaptic()}
                  onPress={() => void requestPerm()}
                  style={({ pressed }) => [styles.scanCameraPermissionButton, pressed && styles.scanCtaPressed]}
                  accessibilityRole={'button'}
                >
                  <Text style={styles.scanCameraPermissionButtonText}>Allow Camera Access</Text>
                </Pressable>
                <Pressable
                  onPress={cancelCamera}
                  hitSlop={10}
                  style={({ pressed }) => [styles.scanCameraCancelButton, pressed && styles.scanControlPressed]}
                  accessibilityRole={'button'}
                >
                  <Text style={styles.scanCameraCancelText}>Not now</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          ) : (
            <>
              <CameraView ref={cameraRef} active facing={cameraFacing} style={StyleSheet.absoluteFill} />
              <SafeAreaView pointerEvents={'box-none'} style={styles.scanCameraSafeArea}>
                <View pointerEvents={'none'} style={styles.scanCameraHeading}>
                  <View style={styles.scanCameraStepPill}>
                    <View style={styles.scanCameraStepDot} />
                    <Text style={styles.scanCameraStepText}>
                      {pose === 'frontal' ? 'FRONTAL PHOTO' : 'SIDE PHOTO'}
                    </Text>
                  </View>
                  <Text style={styles.scanCameraTitle}>
                    {pose === 'frontal' ? 'Hold steady' : 'Turn to your side'}
                  </Text>
                  <Text style={styles.scanCameraBody}>
                    {pose === 'frontal' ? 'Keep your face centered and still' : 'Align your profile with the guide'}
                  </Text>
                </View>

                <View style={styles.scanCameraControls}>
                  <Pressable
                    onPressIn={() => {
                      if (!capturing) void triggerScanButtonHaptic();
                    }}
                    onPress={() => void capture()}
                    disabled={capturing}
                    style={({ pressed }) => [
                      styles.scanShutter,
                      capturing && styles.scanShutterDisabled,
                      pressed && !capturing && styles.scanShutterPressed,
                    ]}
                    accessibilityRole={'button'}
                    accessibilityLabel={'Take photo'}
                  >
                    <View style={styles.scanShutterInner} />
                  </Pressable>

                  <View style={styles.scanCameraActionRow}>
                    <Pressable
                      onPressIn={() => void triggerScanControlHaptic()}
                      onPress={() => void pickFromGallery()}
                      style={({ pressed }) => [styles.scanCameraActionButton, pressed && styles.scanControlPressed]}
                      accessibilityRole={'button'}
                    >
                      <Text style={styles.scanCameraActionText}>Library</Text>
                    </Pressable>
                    <Pressable
                      onPressIn={() => void triggerScanControlHaptic()}
                      onPress={() => setCameraFacing((current) => (current === 'front' ? 'back' : 'front'))}
                      style={({ pressed }) => [styles.scanCameraActionButton, pressed && styles.scanControlPressed]}
                      accessibilityRole={'button'}
                    >
                      <Text style={styles.scanCameraActionText}>Flip camera</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={cancelCamera}
                    hitSlop={10}
                    style={({ pressed }) => [styles.scanCameraCancelButton, pressed && styles.scanControlPressed]}
                    accessibilityRole={'button'}
                  >
                    <Text style={styles.scanCameraCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </SafeAreaView>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={false && cameraOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {permissionDenied ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP[6] }}>
              <Text style={{ color: "#FFFFFF", fontFamily: FONT, fontSize: ms(16), marginBottom: sh(16), textAlign: "center" }}>
                Camera permission required
              </Text>
              <Pressable
                onPress={() => void requestPerm()}
                style={({ pressed }) => ({
                  minHeight: sh(56),
                  borderRadius: 999,
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: sh(16),
                  paddingHorizontal: SP[6],
                  opacity: pressed ? 0.85 : 1,
                  alignSelf: "stretch",
                })}
              >
                <Text style={{ color: COLORS.ctaBlack, fontFamily: FONT, fontSize: ms(15), letterSpacing: 0.6 }}>
                  GRANT PERMISSION
                </Text>
              </Pressable>
              <Pressable onPress={() => setCameraOpen(false)} style={{ marginTop: sh(14) }}>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: FONT, fontSize: ms(13) }}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView ref={cameraRef} active={true} facing={cameraFacing} style={StyleSheet.absoluteFill} />

              {/* Instruction label */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: sh(56),
                  left: 0,
                  right: 0,
                  alignItems: "center",
                }}
              >
                <Text style={{
                  color: "#FFFFFF",
                  fontFamily: FONT,
                  fontSize: ms(20),
                  letterSpacing: -0.3,
                  textShadowColor: "rgba(0,0,0,0.6)",
                  textShadowRadius: 6,
                  textShadowOffset: { width: 0, height: 1 },
                }}>
                  {pose === "frontal" ? "Hold Steady" : "Turn to your side"}
                </Text>
                <Text style={{
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: FONT,
                  fontSize: ms(13),
                  marginTop: sh(4),
                  textShadowColor: "rgba(0,0,0,0.6)",
                  textShadowRadius: 4,
                  textShadowOffset: { width: 0, height: 1 },
                }}>
                  {pose === "frontal" ? "Keep your face centered and still" : "Align your profile with the oval"}
                </Text>
              </View>

              {/* Bottom controls */}
              <View style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                paddingBottom: sh(40),
                paddingTop: SP[4],
                alignItems: "center",
                gap: sh(14),
              }}>
                {/* Shutter — large white circle */}
                <Pressable
                  onPress={capture}
                  disabled={capturing}
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                  accessibilityState={{ disabled: capturing }}
                  style={({ pressed }) => ({
                    width: ms(80),
                    height: ms(80),
                    borderRadius: ms(40),
                    borderWidth: 4,
                    borderColor: capturing ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                    opacity: capturing ? 0.5 : 1,
                    transform: [{ scale: pressed ? 0.93 : 1 }],
                  })}
                >
                  <View style={{ width: ms(62), height: ms(62), borderRadius: ms(31), backgroundColor: "#FFFFFF" }} />
                </Pressable>

                {/* Gallery picker */}
                <Pressable
                  onPress={pickFromGallery}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sw(10),
                    backgroundColor: "rgba(255,255,255,0.12)",
                    borderRadius: 999,
                    paddingHorizontal: sw(20),
                    paddingVertical: sh(10),
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <View style={{ width: 16, height: 16, flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.85)" }} />
                    ))}
                  </View>
                  <Text style={{ color: "#FFFFFF", fontFamily: FONT, fontSize: ms(13), letterSpacing: 0.2 }}>
                    Choose from Library
                  </Text>
                </Pressable>

                {/* Flip camera */}
                <Pressable
                  onPress={() => setCameraFacing((f) => (f === "front" ? "back" : "front"))}
                  style={({ pressed }) => ({
                    paddingHorizontal: sw(12),
                    paddingVertical: sh(8),
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.10)",
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONT, fontSize: ms(12), letterSpacing: 0.4 }}>
                    Flip camera
                  </Text>
                </Pressable>

                {/* Cancel */}
                <Pressable
                  onPress={() => {
                    if (frontalUri) {
                      Alert.alert(
                        "Cancel scan?",
                        "Your frontal photo will be lost and you'll need to start over.",
                        [
                          { text: "Keep scanning", style: "cancel" },
                          { text: "Cancel scan", style: "destructive", onPress: () => { setCameraOpen(false); setStep("intro"); setFrontalUri(null); setSideUri(null); setPose("frontal"); } },
                        ]
                      );
                    } else {
                      setCameraOpen(false);
                    }
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: FONT, fontSize: ms(12) }}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>

    </>
  );
}
const styles = StyleSheet.create({
  scanTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  scanScreen: {
    flex: 1,
    backgroundColor: APP_SCREEN_BG,
  },
  scanSafeArea: {
    flex: 1,
    backgroundColor: APP_SCREEN_BG,
  },
  scanContent: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },
  scanTopBarCompact: {
    paddingTop: 6,
  },
  streakPill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 9,
    paddingRight: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: SCAN_SURFACE,
    borderWidth: 1,
    borderColor: "rgba(20,18,14,0.06)",
    shadowColor: "#14120E",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  streakNumber: {
    color: SCAN_INK,
    fontFamily: SCAN_FONT_BOLD,
    fontSize: 15,
    lineHeight: 17,
  },
  streakLabel: {
    marginTop: 2,
    color: SCAN_FAINT,
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.3,
  },
  historyButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SCAN_SURFACE,
    borderWidth: 1,
    borderColor: "rgba(20,18,14,0.06)",
    shadowColor: "#14120E",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scanControlPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  scanIntroCopy: {
    flexShrink: 0,
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  scanIntroCopyCompact: {
    paddingTop: 5,
  },
  scanEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scanEyebrowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SCAN_ORANGE,
  },
  scanEyebrow: {
    color: SCAN_ORANGE,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
  },
  scanTitle: {
    marginTop: 6,
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.1,
    textAlign: "center",
  },
  scanHero: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    marginHorizontal: 6,
    marginTop: 8,
  },
  faceCard: {
    position: "absolute",
    backgroundColor: "#EEEDEB",
    shadowColor: "#140F0A",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 9,
  },
  faceClip: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  facePortrait: {
    width: "100%",
    height: "100%",
  },
  scanSweepBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  faceBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
  },
  metricPill: {
    position: "absolute",
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(20,18,14,0.06)",
    shadowColor: "#140F0A",
    shadowOpacity: 0.17,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  metricIconViewport: {
    flexShrink: 0,
    overflow: "hidden",
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricEyebrow: {
    color: SCAN_FAINT,
    fontFamily: SCAN_FONT_SEMIBOLD,
  },
  metricValue: {
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    letterSpacing: 0.1,
  },
  scanFootnote: {
    flexShrink: 0,
    marginTop: 8,
    color: SCAN_FAINT,
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: "center",
  },
  scanCtaWrap: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom + 12,
  },
  scanCtaWrapCompact: {
    paddingTop: 7,
    paddingBottom: FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom + 8,
  },
  scanCta: {
    position: "relative",
    minHeight: 50,
    width: "100%",
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 15,
    paddingHorizontal: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  scanCtaPressed: {
    transform: [{ scale: 0.98 }],
  },
  scanCtaPulseRing: {
    position: "absolute",
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.28)",
  },
  scanCtaGradient: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
  },
  scanCtaText: {
    color: "#FAF9F7",
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  scanPrimaryButton: {
    position: 'relative',
    minHeight: 50,
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  scanPrimaryButtonDisabled: {
    backgroundColor: SCAN_SURFACE,
    borderColor: 'rgba(20,18,14,0.06)',
    shadowOpacity: 0,
    elevation: 0,
  },
  scanPrimaryButtonText: {
    color: '#FAF9F7',
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  scanPrimaryButtonTextDisabled: {
    color: SCAN_FAINT,
  },
  scanGuidedContent: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  scanStepHeading: {
    flexShrink: 0,
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  scanStepTitle: {
    marginTop: 6,
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: 0.05,
    textAlign: 'center',
  },
  scanGuideHero: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  scanGuideCard: {
    height: '100%',
    maxHeight: 410,
    aspectRatio: 3 / 4,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#EEEDEB',
    borderWidth: 1,
    borderColor: 'rgba(20,18,14,0.06)',
    shadowColor: '#140F0A',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  scanGuideImage: {
    width: '100%',
    height: '100%',
  },
  scanGuideCaptionRow: {
    flexShrink: 0,
    minHeight: 42,
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: SCAN_SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(20,18,14,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  scanGuideCaptionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: SCAN_ORANGE,
    flexShrink: 0,
  },
  scanGuideCaption: {
    flexShrink: 1,
    color: SCAN_MUTED,
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  scanGuideFooter: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom + 12,
  },
  scanStepDots: {
    height: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  scanStepDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#DDD9D3',
  },
  scanStepDotActive: {
    width: 20,
    backgroundColor: SCAN_ORANGE,
  },
  scanReviewGrid: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  scanReviewItem: {
    flex: 1,
    minWidth: 0,
  },
  scanReviewLabel: {
    marginBottom: 7,
    color: SCAN_FAINT,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.5,
  },
  scanReviewCard: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EEEDEB',
    borderWidth: 1,
    borderColor: 'rgba(20,18,14,0.07)',
    shadowColor: '#140F0A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  scanReviewImage: {
    width: '100%',
    height: '100%',
  },
  scanSecondaryButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: SCAN_SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(20,18,14,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  scanSecondaryButtonText: {
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 13,
    lineHeight: 16,
  },
  scanReviewHint: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginHorizontal: 20,
    paddingTop: 12,
  },
  scanReviewFooter: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom + 8,
  },
  scanStartOverButton: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
  },
  scanStartOverText: {
    color: SCAN_MUTED,
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 17,
  },
  scanSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21,19,15,0.48)',
  },
  scanSheetSafeArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scanSheet: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(20,18,14,0.07)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  scanSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D4CE',
    marginBottom: 18,
  },
  scanSheetTitle: {
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 22,
    lineHeight: 27,
  },
  scanSheetBody: {
    color: SCAN_MUTED,
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 18,
  },
  scanSheetSecondaryButton: {
    minHeight: 50,
    width: '100%',
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: SCAN_SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(20,18,14,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  scanSheetSecondaryText: {
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 20,
  },
  scanCamera: {
    flex: 1,
    backgroundColor: SCAN_INK,
  },
  scanCameraSafeArea: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  scanCameraHeading: {
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  scanCameraStepPill: {
    minHeight: 32,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: 'rgba(21,19,15,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  scanCameraStepDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: SCAN_ORANGE,
  },
  scanCameraStepText: {
    color: '#FAF9F7',
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.4,
  },
  scanCameraTitle: {
    color: '#FAF9F7',
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 22,
    lineHeight: 27,
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  scanCameraBody: {
    color: 'rgba(250,249,247,0.74)',
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  scanCameraControls: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(21,19,15,0.42)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  scanShutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: 'rgba(250,249,247,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,19,15,0.22)',
  },
  scanShutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FAF9F7',
    borderWidth: 1,
    borderColor: 'rgba(21,19,15,0.08)',
  },
  scanShutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  scanShutterDisabled: {
    opacity: 0.45,
  },
  scanCameraActionRow: {
    width: '100%',
    maxWidth: 330,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  scanCameraActionButton: {
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(250,249,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,249,247,0.16)',
  },
  scanCameraActionText: {
    color: '#FAF9F7',
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 13,
    lineHeight: 17,
  },
  scanCameraCancelButton: {
    minHeight: 36,
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  scanCameraCancelText: {
    color: 'rgba(250,249,247,0.68)',
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 17,
  },
  scanCameraPermissionSafeArea: {
    flex: 1,
  },
  scanCameraPermissionContent: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scanCameraPermissionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,249,247,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250,249,247,0.14)',
    marginBottom: 16,
  },
  scanCameraPermissionTitle: {
    color: '#FAF9F7',
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  scanCameraPermissionBody: {
    maxWidth: 310,
    color: 'rgba(250,249,247,0.68)',
    fontFamily: SCAN_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  scanCameraPermissionButton: {
    minHeight: 50,
    width: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FAF9F7',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  scanCameraPermissionButtonText: {
    color: SCAN_INK,
    fontFamily: SCAN_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 20,
  },
});
async function ensurePersistentImageDir(): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error("Persistent storage unavailable");
  const dir = `${base.replace(/\/?$/, "/")}images/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function persistCompressedResult<T extends { uri: string; name: string }>(
  result: T
): Promise<T> {
  const dir = await ensurePersistentImageDir();
  const filename = `${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
  const dest = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return { ...result, uri: dest };
}
