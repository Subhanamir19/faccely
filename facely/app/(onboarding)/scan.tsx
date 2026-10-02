// app/(onboarding)/scan.tsx
// Onboarding face scan — captures frontal + side photos and stores them for
// post-purchase analysis. The intro is a Face ID style ring around the guide
// face on the light onboarding ground. The camera modal stays dark by nature
// (live camera feed); only the lime accents are swapped for sage.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Alert,
  Pressable,
  Modal,
  StatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import { hapticHeavy, hapticSuccess, hapticThud } from "@/lib/haptics";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Camera, Glasses, Lock, Smile, Sun } from "lucide-react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { ensureJpegCompressed } from "@/lib/api/media";
import { useOnboarding } from "@/store/onboarding";
import { logger } from "@/lib/logger";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sh, sw, useResponsiveScale } from "@/lib/responsive";

const FONT_BOLD = "SFProRounded-Bold";
const FONT_REGULAR = "SFProRounded-Regular";
const SOFT_SCREEN_BG = "#FEF5E4";
const LIME = "#B4F34D";        // bright fill — scan line, live dot, perm btn, active step dot
const SAGE = "#3F7A2A";        // dark readable — text on white / lime-soft

type Step = "intro" | "review";

/* ───────────────────── Face ID style scan ring ───────────────────── */
// Modelled on iPhone Face ID enrolment: the face sits in a circular frame and
// a ring of tick marks fills in around it, then resets. No card, no fake LIVE
// chip — the ring itself is the "scanning" signal.

const RING_TICKS = 72;
const TICK_LENGTH = 11;
const TICK_GAP = 14;               // space between tick ring and face circle
const TICK_STEP_MS = 28;           // time for one tick to light
const TICK_HOLD_STEPS = 24;        // full ring holds for this many steps
const TICK_IDLE = "rgba(11,11,11,0.12)";
const TICK_LIT = "#8CCB3A";        // lime deep enough to read on cream

// Where the head sits in frontal-guide-vector.jpg (1086×1448), as fractions
// of the image height — used to crop the torso away and centre the face.
const GUIDE_ASPECT = 1086 / 1448;
const GUIDE_HEAD_SPAN = 0.566;     // hair top → chin
const GUIDE_HEAD_CENTER_Y = 0.331;

function ScanRing({ size }: { size: number }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % (RING_TICKS + TICK_HOLD_STEPS));
    }, TICK_STEP_MS);
    return () => clearInterval(id);
  }, []);

  const lit = Math.min(phase, RING_TICKS);

  const faceSize = size - 2 * (TICK_LENGTH + TICK_GAP);
  // Scale so the head fills ~82% of the circle, then centre it.
  const imgH = (faceSize * 0.82) / GUIDE_HEAD_SPAN;
  const imgW = imgH * GUIDE_ASPECT;
  const imgTop = faceSize / 2 - GUIDE_HEAD_CENTER_Y * imgH;
  const imgLeft = (faceSize - imgW) / 2;

  // Soft scan line sweeping through the face, ping-pong.
  const scanProgress = useSharedValue(0);
  useEffect(() => {
    scanProgress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [scanProgress]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanProgress.value * faceSize }],
    opacity: interpolate(scanProgress.value, [0, 0.5, 1], [0.3, 0.9, 0.3], "clamp"),
  }));

  const c = size / 2;
  const rOuter = c - 1;
  const rInner = rOuter - TICK_LENGTH;

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {Array.from({ length: RING_TICKS }, (_, i) => {
          // Start at 12 o'clock, go clockwise.
          const angle = (i / RING_TICKS) * Math.PI * 2 - Math.PI / 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          return (
            <Line
              key={i}
              x1={c + rInner * cos}
              y1={c + rInner * sin}
              x2={c + rOuter * cos}
              y2={c + rOuter * sin}
              stroke={i < lit ? TICK_LIT : TICK_IDLE}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>

      <View
        style={[
          ringStyles.face,
          {
            width: faceSize,
            height: faceSize,
            borderRadius: faceSize / 2,
            top: TICK_LENGTH + TICK_GAP,
            left: TICK_LENGTH + TICK_GAP,
          },
        ]}
      >
        <Image
          source={require("../../assets/capture-guides/frontal-guide-vector.jpg")}
          style={{ position: "absolute", width: imgW, height: imgH, top: imgTop, left: imgLeft }}
          resizeMode="cover"
        />
        <Animated.View pointerEvents="none" style={[ringStyles.scanLine, scanLineStyle]}>
          <LinearGradient
            colors={["transparent", LIME, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** "1 Front · 2 Side" — tells the user up front there are two photos. */
function PoseSteps() {
  return (
    <View style={ringStyles.poseRow}>
      {[
        { n: "1", label: "Front", active: true },
        { n: "2", label: "Side", active: false },
      ].map(({ n, label, active }) => (
        <View key={n} style={ringStyles.pose}>
          <View style={[ringStyles.poseNum, active && ringStyles.poseNumActive]}>
            <T style={[ringStyles.poseNumText, active && ringStyles.poseNumTextActive]}>{n}</T>
          </View>
          <T style={ringStyles.poseLabel}>{label}</T>
        </View>
      ))}
    </View>
  );
}

const TIPS = [
  { Icon: Sun, label: "Good light" },
  { Icon: Glasses, label: "No glasses" },
  { Icon: Smile, label: "Neutral face" },
] as const;

function PhotoTips() {
  return (
    <View style={ringStyles.tipsRow}>
      {TIPS.map(({ Icon, label }) => (
        <View key={label} style={ringStyles.tip}>
          <View style={ringStyles.tipIcon}>
            <Icon size={18} color={COLORS.lightText} strokeWidth={1.8} />
          </View>
          <T style={ringStyles.tipLabel}>{label}</T>
        </View>
      ))}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  face: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#FCFCFC",   // matches the guide image's own ground
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
  },
  poseRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SP[4],
    marginTop: SP[4],
  },
  pose: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
  },
  poseNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(11,11,11,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  poseNumActive: {
    backgroundColor: COLORS.lightText,
    borderColor: COLORS.lightText,
  },
  poseNumText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(11),
    color: COLORS.lightSub,
  },
  poseNumTextActive: {
    color: "#FFFFFF",
  },
  poseLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  tipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SP[5],
  },
  tip: {
    flex: 1,
    alignItems: "center",
    gap: sh(8),
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(11,11,11,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipLabel: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(12),
    color: COLORS.lightSub,
  },
});

/* ───────────────────────── helpers ───────────────────────── */
function toFileUri(u: string) {
  if (u.startsWith("file://") || u.startsWith("http")) return u;
  if (u.startsWith("/")) return `file://${u}`;
  return u;
}

async function ensureFileUriAsync(raw?: string | null): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("content://")) {
    const dest = `${FileSystem.cacheDirectory}ob_capture_${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: raw, to: dest });
      return dest;
    } catch {
      return raw;
    }
  }
  return toFileUri(raw);
}

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
  result: T,
): Promise<T> {
  const dir = await ensurePersistentImageDir();
  const filename = `${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
  const dest = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return { ...result, uri: dest };
}

/* ───────────────────────── main screen ───────────────────────── */
export default function OnboardingScanScreen() {
  const responsive = useResponsiveScale();
  const { width: windowWidth } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const permissionDenied = perm?.granted === false;

  const [step, setStep] = useState<Step>("intro");
  const [pose, setPose] = useState<"frontal" | "side">("frontal");
  const [frontalUri, setFrontalUri] = useState<string | null>(null);
  const [sideUri, setSideUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { setScanPhotos } = useOnboarding();
  const insets = useSafeAreaInsets();

  const openCamera = async () => {
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) {
        // The scan can't be skipped, so a denied camera must never strand the
        // user: offer the library, or Settings if iOS won't ask again.
        Alert.alert(
          "Camera access needed",
          "Allow camera access to scan your face, or choose photos from your library instead.",
          [
            { text: "Choose from Library", onPress: () => void pickFromGallery() },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
            { text: "Not now", style: "cancel" },
          ],
        );
        return;
      }
    }
    setCameraOpen(true);
  };

  const handleChosen = async (uri: string | null) => {
    if (!uri) return;
    try {
      const normalized = await ensureFileUriAsync(uri);
      if (!normalized) throw new Error("Bad photo path");
      if (pose === "frontal") {
        setFrontalUri(normalized);
        setPose("side");
        setCameraOpen(true);
      } else {
        setSideUri(normalized);
        hapticSuccess();
        setStep("review");
      }
    } catch (e) {
      logger.error("[SCAN] normalize failed", e);
      Alert.alert("File error", "Could not use the selected photo.");
    }
  };

  const retake = (nextPose: "frontal" | "side") => {
    setPose(nextPose);
    void openCamera();
  };

  const pickFromGallery = async () => {
    setCameraOpen(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) await handleChosen(res.assets?.[0]?.uri || null);
  };

  const capture = async () => {
    hapticHeavy();
    try {
      const cam: any = cameraRef.current;
      const photo =
        (await cam?.takePictureAsync?.({ quality: 1, skipProcessing: false })) ||
        (await cam?.takePhoto?.({ quality: 1 })) ||
        null;
      const raw = photo?.uri ?? photo?.path ?? photo?.assets?.[0]?.uri;
      setCameraOpen(false);
      await handleChosen(raw || null);
    } catch (e: any) {
      Alert.alert("Camera error", String(e?.message || e));
      setCameraOpen(false);
    }
  };

  const beginScan = () => {
    setFrontalUri(null);
    setSideUri(null);
    setPose("frontal");
    void openCamera();
  };

  const submitPhotos = async () => {
    if (!frontalUri || !sideUri || submitting) return;
    setSubmitting(true);
    try {
      const fResolved = await ensureFileUriAsync(frontalUri);
      const sResolved = await ensureFileUriAsync(sideUri);
      if (!fResolved || !sResolved) throw new Error("Could not read selected photos.");

      const [frontInfo, sideInfo] = await Promise.all([
        FileSystem.getInfoAsync(fResolved),
        FileSystem.getInfoAsync(sResolved),
      ]);
      if (!frontInfo.exists || !sideInfo.exists) {
        Alert.alert("Photos missing", "Please retake or reselect your photos.");
        return;
      }

      const [fTemp, sTemp] = await Promise.all([
        ensureJpegCompressed(fResolved),
        ensureJpegCompressed(sResolved),
      ]);
      const [fFinal, sFinal] = await Promise.all([
        persistCompressedResult(fTemp),
        persistCompressedResult(sTemp),
      ]);

      setScanPhotos(fFinal.uri, sFinal.uri);
      router.push("/(onboarding)/studies");
    } catch (err) {
      logger.error("[SCAN] submit failed", err);
      Alert.alert("Couldn't proceed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── camera modal — dark by nature, sage accent dots ── */
  const cameraModal = (
    <Modal
      visible={cameraOpen}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => setCameraOpen(false)}
    >
      <StatusBar hidden />
      <View style={camStyles.root}>
        {permissionDenied ? (
          <SafeAreaView style={camStyles.permWrap}>
            <ScrollView
              contentContainerStyle={camStyles.permContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
            <T style={camStyles.permText}>
              Camera permission is required to analyze your face.
            </T>
            <Pressable
              onPress={() =>
                // Once denied for good, the OS won't prompt again; Settings is the only way back.
                perm?.canAskAgain === false ? void Linking.openSettings() : void requestPerm()
              }
              style={({ pressed }) => [
                camStyles.permBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <T style={camStyles.permBtnText}>GRANT PERMISSION</T>
            </Pressable>
            <Pressable onPress={() => setCameraOpen(false)} style={{ marginTop: SP[3] }}>
              <T style={camStyles.permClose}>Close</T>
            </Pressable>
            </ScrollView>
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              active={cameraOpen}
              facing="front"
              style={StyleSheet.absoluteFill}
            />

            {/* Top instruction card — glass on dark, sage step dots */}
            <View
              pointerEvents="none"
              style={[
                camStyles.instructions,
                {
                  top: insets.top + SP[3],
                  left: SP[5],
                  right: SP[5],
                },
              ]}
            >
              <T style={camStyles.instructionTitle}>
                {pose === "frontal" ? "Face Forward" : "Turn to Your Side"}
              </T>
              <T style={camStyles.instructionSub}>
                {pose === "frontal"
                  ? "Center your face, neutral expression"
                  : "Align your profile with the oval"}
              </T>
              <View style={camStyles.dotRow}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={[
                      camStyles.dot,
                      (pose === "frontal" ? i === 0 : i === 1) && camStyles.dotActive,
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Bottom controls */}
            <View
              style={[
                camStyles.bottom,
                { paddingBottom: Math.max(insets.bottom + SP[4], SP[8]) },
              ]}
            >
              <Pressable
                onPress={capture}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                style={({ pressed }) => [
                  camStyles.shutter,
                  { transform: [{ scale: pressed ? 0.93 : 1 }] },
                ]}
              >
                <View style={camStyles.shutterCore} />
              </Pressable>

              <Pressable
                onPress={pickFromGallery}
                style={({ pressed }) => [
                  camStyles.libBtn,
                  pressed && { opacity: 0.65 },
                ]}
              >
                <T style={camStyles.libBtnText}>Choose from Library</T>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );

  /* ── intro ── */
  if (step === "intro") {
    return (
      <View style={styles.introScreen}>
        <StatusBar barStyle="dark-content" />
        {cameraModal}
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={styles.introWrap}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Title block — opens the screen with intent */}
            <View style={styles.heroCopy}>
              <T style={styles.heroTitle}>Let’s scan your face</T>
              <T style={styles.heroSub}>
                Two photos, front and side. About 10 seconds.
              </T>
            </View>

            {/* Face ID style ring — the animation is the product preview. */}
            <View style={styles.ringArea}>
              <ScanRing size={Math.min(windowWidth - SP[5] * 2, sw(300))} />
              <PoseSteps />
            </View>

            {/* Tips + actions, anchored to the bottom */}
            <View>
              <PhotoTips />
              <View style={styles.actions}>
                <Pressable
                  onPress={() => {
                    hapticThud();
                    beginScan();
                  }}
                  style={({ pressed }) => [
                    styles.cta,
                    { minHeight: responsive.clamp(54, 48, 60) },
                    pressed && { backgroundColor: COLORS.ctaBlackPressed },
                  ]}
                >
                  <View style={styles.ctaInner}>
                    <Camera size={18} color="#FFFFFF" strokeWidth={2} />
                    <T style={styles.ctaText}>Start scan</T>
                  </View>
                </Pressable>

                <View style={styles.privacyRow}>
                  <Lock size={12} color={COLORS.lightSub} strokeWidth={2.2} />
                  <T style={styles.privacyText}>Your photos are only used to analyze your face.</T>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  /* ── review ── */
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      {cameraModal}
      <SafeAreaView style={styles.reviewSafe}>
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={styles.reviewContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        <T style={styles.reviewTitle}>Review your photos</T>

        <View style={styles.thumbRow}>
          {([
            { label: "Frontal", uri: frontalUri, p: "frontal" as const },
            { label: "Side",    uri: sideUri,    p: "side"    as const },
          ]).map(({ label, uri, p }) => (
            <View key={label} style={styles.thumbCol}>
              <T style={styles.thumbLabel}>{label.toUpperCase()}</T>
              <View style={styles.thumb}>
                {uri && (
                  <Image
                    source={{ uri }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                )}
              </View>
              <Pressable onPress={() => retake(p)}>
                <T style={styles.retake}>Retake</T>
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          onPress={submitPhotos}
          disabled={!frontalUri || !sideUri || submitting}
          style={({ pressed }) => [
            styles.cta,
            { marginTop: SP[5] },
            { minHeight: responsive.clamp(54, 48, 60) },
            submitting && { opacity: 0.7 },
            pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={styles.ctaText}>
            {submitting ? "PREPARING…" : "ANALYZE MY POTENTIAL"}
          </T>
        </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },
  introScreen: { flex: 1, backgroundColor: SOFT_SCREEN_BG },
  safe: { flex: 1 },

  // ── intro ──
  introWrap: {
    flexGrow: 1,
    paddingHorizontal: SP[5],
    paddingTop: SP[6],
    paddingBottom: SP[3],
    justifyContent: "space-between",
  },
  ringArea: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: SP[5],
  },
  // Title block — leads at the top with confident hierarchy.
  heroCopy: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: SP[3],
  },
  heroTitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    letterSpacing: 0,
    color: COLORS.lightText,
    textAlign: "center",
  },
  heroSub: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    textAlign: "center",
    marginTop: sh(6),
  },
  // Action block — CTA anchored at the bottom for a clear next step.
  actions: {
    width: "100%",
    gap: sh(8),
  },

  cta: {
    width: "100%",
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(16),
    color: "#FFFFFF",
    letterSpacing: 0,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(5),
  },
  privacyText: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(12),
    color: COLORS.lightSub,
    letterSpacing: 0,
  },

  // ── review ──
  reviewSafe: {
    flex: 1,
  },
  reviewScroll: {
    flex: 1,
    width: "100%",
  },
  reviewContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
    paddingVertical: SP[5],
  },
  reviewTitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(22),
    color: COLORS.lightText,
    letterSpacing: 0,
    marginBottom: SP[4],
  },
  thumbRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SP[3],
  },
  thumbCol: {
    flex: 1,
  },
  thumbLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 0,
    marginBottom: sh(6),
  },
  thumb: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: RADII.md,
    overflow: "hidden",
    backgroundColor: COLORS.lightSurface,
    borderWidth: 1,
    borderColor: COLORS.lightHairline,
  },
  thumbImg: { width: "100%", height: "100%" },
  retake: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12),
    color: SAGE,
    letterSpacing: 0.4,
    marginTop: sh(8),
  },
});

const camStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  permWrap: {
    flex: 1,
  },
  permContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  },
  permText: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(15),
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: SP[3],
    lineHeight: ms(22),
  },
  permBtn: {
    backgroundColor: LIME,
    paddingHorizontal: SP[5],
    paddingVertical: sh(12),
    borderRadius: 999,
  },
  permBtnText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13),
    color: "#0B0B0B",
    letterSpacing: 0.6,
  },
  permClose: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(13),
    color: "rgba(255,255,255,0.55)",
  },

  instructions: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADII.lg,
    paddingHorizontal: SP[5],
    paddingVertical: SP[4],
    alignItems: "center",
  },
  instructionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(18),
    color: "#FFFFFF",
    letterSpacing: 0,
    marginBottom: 2,
  },
  instructionSub: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(12),
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
  },
  dotRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: sh(10),
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  dotActive: {
    backgroundColor: LIME,
  },

  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: SP[4],
  },
  shutter: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(40),
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  shutterCore: {
    width: ms(62),
    height: ms(62),
    borderRadius: ms(31),
    backgroundColor: "#FFFFFF",
  },
  libBtn: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: SP[5],
    paddingVertical: sh(11),
  },
  libBtnText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13),
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 0.3,
  },
});
