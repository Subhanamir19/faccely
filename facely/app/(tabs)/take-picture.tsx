// C:\SS\facely\app\(tabs)\take-picture.tsx
import React, { useRef, useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { History as HistoryIcon } from "lucide-react-native";
import RecoveryCodeHint from "@/components/ui/RecoveryCodeHint";
import StreakIcon from "@/assets/icons-for-dashboard/streak-icon (1) (1).svg";

// NEW: shared pre-upload compressor (JPEG, max 1080px)
import { ensureJpegCompressed } from "../../lib/api/media";
import { logger } from '@/lib/logger';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/store/auth";
import { getWeekScanData, checkScanLimit, WEEKLY_SCAN_LIMIT } from "@/lib/supabase/scanLimit";
import { getNextMonday } from "@/lib/time/nextMidnight";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";

// Soft drop-shadow recipe shared by all elevated surfaces — same recipe used
// across dashboard, routine list, workout preview.
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

// Reusable Proxima Bold font ref — file is large; avoid per-Text repetition.
const FONT = "ProximaNova-Bold";
const SOFT_SCREEN_BG = "#FEF5E4";

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
  // Functional header chip — scans used this week / weekly limit
  const [scansThisWeek, setScansThisWeek] = useState<number | null>(null);

  // Fetch the user's weekly scan count on mount, and refresh whenever they
  // return to the intro step (so the chip reflects a freshly-completed scan).
  useEffect(() => {
    if (step !== "intro") return;
    const uid = useAuthStore.getState().uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { weekCount } = await getWeekScanData(uid);
        if (!cancelled) setScansThisWeek(weekCount);
      } catch {
        // Silent: chip just stays at its previous value
      }
    })();
    return () => { cancelled = true; };
  }, [step]);
  const cameraRef = useRef<CameraView>(null);
  // Prevents concurrent handleChosen calls (e.g. double-tap gallery)
  const handlingRef = useRef(false);

  const window = useWindowDimensions();

  const headingFontSize = window.width >= 420 ? 34 : window.width >= 360 ? 30 : 28;

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
    if (bypass === "true") {
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
    void startCamera();
  };

  const goToHistory = () => {
    router.push("/(tabs)/history" as any);
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

  const renderIntro = () => (
    <View style={{ flex: 1, backgroundColor: SOFT_SCREEN_BG }}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: SP[5] }}>
          {/* Header — title + caption + light History pill */}
          <View
            style={{
              marginTop: sh(24),
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: sh(20),
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: sw(10) }}>
              {/* Functional chip — scans used this week */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: sw(6),
                  backgroundColor: COLORS.ctaBlack,
                  paddingHorizontal: sw(12),
                  paddingVertical: sh(8),
                  borderRadius: 999,
                }}
              >
                <StreakIcon width={ms(16)} height={ms(16)} />
                <Text style={{ color: "#FFFFFF", fontFamily: FONT, fontSize: ms(13), letterSpacing: -0.1 }}>
                  {scansThisWeek ?? 0}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: FONT, fontSize: ms(11), letterSpacing: 0.2 }}>
                  / {WEEKLY_SCAN_LIMIT} this week
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                goToHistory();
              }}
              hitSlop={16}
              style={({ pressed }) => ({
                minHeight: sh(46),
                flexDirection: "row",
                alignItems: "center",
                gap: sw(8),
                backgroundColor: COLORS.lightCard,
                borderWidth: 1,
                borderColor: "rgba(11,11,11,0.08)",
                paddingHorizontal: sw(18),
                paddingVertical: sh(12),
                borderRadius: 999,
                opacity: pressed ? 0.82 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...SOFT_SHADOW,
              })}
              accessibilityRole="button"
              accessibilityLabel="Open scan history"
            >
              <HistoryIcon size={ms(16)} color={COLORS.lightText} strokeWidth={2.4} />
              <Text style={{ color: COLORS.lightText, fontFamily: FONT, fontSize: ms(16), letterSpacing: 0.2 }}>
                History
              </Text>
            </Pressable>
          </View>

          {/* ── Scan card — image hero + caption + black CTA ── */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: "100%",
                maxWidth: 400,
                borderRadius: RADII.lg,
                overflow: "hidden",
                backgroundColor: COLORS.lightCard,
                ...SOFT_SHADOW,
              }}
            >
              <View style={{ width: "100%", aspectRatio: 0.85, backgroundColor: COLORS.lightCard, overflow: "hidden" }}>
                <Image
                  source={require("../../assets/capture-guides/frontal-guide-vector.png")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>
              <View style={{ paddingHorizontal: SP[5], paddingTop: SP[5], paddingBottom: SP[5], alignItems: "center" }}>
                <Text
                  style={{
                    color: COLORS.lightText,
                    textAlign: "center",
                    fontFamily: FONT,
                    fontSize: ms(22),
                    lineHeight: ms(28),
                    letterSpacing: -0.4,
                    marginBottom: sh(18),
                  }}
                >
                  Get your accurate{"\n"}facial analysis
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    beginScan();
                  }}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: "100%",
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
                    BEGIN SCAN
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );

  const renderGuide = ({
    guideSrc,
    title,
    overlay,
  }: {
    guideSrc: any;
    title: string;
    overlay: "frontal" | "side";
  }) => (
    <View style={{ flex: 1, backgroundColor: SOFT_SCREEN_BG }}>
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
              ? require("../../assets/capture-guides/frontal-guide-vector.png")
              : require("../../assets/capture-guides/side-guy-vector.png"),
          title: pose === "frontal" ? "Take Frontal Photo" : "Take Side Photo",
          overlay: pose,
        })}

      {step === "review" && (
        <View style={{ flex: 1, backgroundColor: SOFT_SCREEN_BG }}>
          <StatusBar barStyle="dark-content" />
          <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP[5] }}>
            <Text
              style={{
                color: COLORS.lightText,
                fontFamily: FONT,
                fontSize: ms(22),
                lineHeight: ms(26),
                letterSpacing: -0.4,
                marginBottom: sh(18),
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
        </View>
      )}

      {/* Chooser — bottom sheet matching the Edit/Targets sheets */}
      <Modal
        visible={chooserOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setChooserOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChooserOpen(false)} />
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
      <Modal visible={cameraOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
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
                    paddingHorizontal: sw(18),
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
