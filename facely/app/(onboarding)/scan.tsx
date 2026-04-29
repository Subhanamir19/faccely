// app/(onboarding)/scan.tsx
// Onboarding face scan — captures frontal + side photos and stores them for
// post-purchase analysis. Light system surrounding a cinematic dark face card
// (mirrors the splash/hook video pattern). The camera modal stays dark by
// nature (live camera feed); only the lime accents are swapped for sage.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Alert,
  Pressable,
  Modal,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { ensureJpegCompressed } from "@/lib/api/media";
import { useOnboarding } from "@/store/onboarding";
import { logger } from "@/lib/logger";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";        // bright fill — scan line, live dot, perm btn, active step dot
const SAGE = "#3F7A2A";        // dark readable — text on white / lime-soft

type Step = "intro" | "review";

/* ───────────────────── hero card with live scan animation ───────────────────── */
function ScanHeroCard() {
  const [imgH, setImgH] = useState(0);

  // Horizontal scan line travels through the vector top→bottom→top, looping.
  const scanProgress = useSharedValue(0);
  // LIVE indicator dot pulses softly.
  const pulse = useSharedValue(1);

  useEffect(() => {
    scanProgress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true, // ping-pong, no jump back
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0,  { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [scanProgress, pulse]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanProgress.value * imgH }],
    opacity: interpolate(
      scanProgress.value,
      [0, 0.5, 1],
      [0.45, 1, 0.45],
      "clamp",
    ),
  }));

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const onLayoutImg = (e: LayoutChangeEvent) => {
    setImgH(e.nativeEvent.layout.height);
  };

  return (
    <View style={heroStyles.card}>
      {/* LIVE chip — top-right, pulsing dot + label */}
      <View style={heroStyles.liveTag}>
        <Animated.View style={[heroStyles.liveDot, dotStyle]} />
        <T style={heroStyles.liveText}>LIVE</T>
      </View>

      {/* Image area — relative-positioned so the scan line can absolutely
          slide across it without overlapping the LIVE chip. */}
      <View style={heroStyles.imageWrap} onLayout={onLayoutImg}>
        <Image
          source={require("../../assets/capture-guides/frontal-guide-vector.png")}
          style={heroStyles.image}
          resizeMode="contain"
        />

        {imgH > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[heroStyles.scanLine, scanLineStyle]}
          >
            <LinearGradient
              colors={["transparent", "#B4F34D", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    flex: 1,
    width: "100%",
    maxWidth: sw(360),
    alignSelf: "center",
    backgroundColor: COLORS.lightCard,
    borderRadius: ms(28),
    paddingVertical: SP[5],
    paddingHorizontal: SP[5],
    marginVertical: SP[4],
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: ms(22),
    shadowOffset: { width: 0, height: ms(8) },
    elevation: 4,
  },
  liveTag: {
    position: "absolute",
    top: SP[3],
    right: SP[3],
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    paddingHorizontal: sw(10),
    paddingVertical: sh(5),
    borderRadius: 999,
    backgroundColor: "#ECFCCB",
    zIndex: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#B4F34D",
  },
  liveText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(10),
    color: "#3F7A2A",
    letterSpacing: 1.2,
  },
  imageWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "85%",
    height: "85%",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
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
        Alert.alert("Permission needed", "Camera access is required to scan your face.");
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

  const skipScan = () => {
    router.push("/(onboarding)/trust");
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
      router.push("/(onboarding)/trust");
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
            <T style={camStyles.permText}>
              Camera permission is required to analyze your face.
            </T>
            <Pressable
              onPress={() => void requestPerm()}
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

              <Pressable onPress={() => setCameraOpen(false)}>
                <T style={camStyles.skipText}>Skip for now</T>
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
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        {cameraModal}
        <SafeAreaView style={styles.safe}>
          <View style={styles.introWrap}>
            {/* Title block — opens the screen with intent */}
            <View style={styles.heroCopy}>
              <T style={styles.heroTitle}>Your scan starts now</T>
              <T style={styles.heroSub}>
                Two photos. The math takes 10 seconds.
              </T>
            </View>

            {/* Hero card — vector face guide with a live scanning animation
                running through it, plus a pulsing LIVE chip in the corner.
                The animation is the product preview. */}
            <ScanHeroCard />

            {/* Action block */}
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  beginScan();
                }}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && { backgroundColor: COLORS.ctaBlackPressed },
                ]}
              >
                <T style={styles.ctaText}>BEGIN SCAN</T>
              </Pressable>

              <Pressable onPress={skipScan} hitSlop={12} style={styles.skipWrap}>
                <T style={styles.skipLabel}>Skip for now</T>
              </Pressable>
            </View>
          </View>
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
            submitting && { opacity: 0.7 },
            pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={styles.ctaText}>
            {submitting ? "PREPARING…" : "ANALYZE MY POTENTIAL"}
          </T>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },
  safe: { flex: 1 },

  // ── intro ──
  introWrap: {
    flex: 1,
    paddingHorizontal: SP[5],
    paddingTop: SP[6],
    paddingBottom: SP[3],
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
    letterSpacing: -0.5,
    color: COLORS.lightText,
    textAlign: "center",
  },
  heroSub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    textAlign: "center",
    marginTop: sh(6),
  },
  // Action block — CTA + skip together at the bottom for clear next-step.
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
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
  skipWrap: {
    alignSelf: "center",
    paddingVertical: SP[2],
  },
  skipLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13),
    color: COLORS.lightSub,
    letterSpacing: 0.2,
  },

  // ── review ──
  reviewSafe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
  },
  reviewTitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(22),
    color: COLORS.lightText,
    letterSpacing: -0.3,
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
    letterSpacing: 1.2,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  },
  permText: {
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-Regular",
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
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  instructionSub: {
    fontFamily: "Poppins-Regular",
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
  skipText: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.45)",
  },
});
