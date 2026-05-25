// app/(onboarding)/face-scan.tsx
// Onboarding face scan — frontal + side photos, then fires analyzePair and navigates to trust.
// No guiding screens — straight to camera/gallery chooser after "Begin Scan".
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Alert,
  Pressable,
  Modal,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ensureJpegCompressed } from "../../lib/api/media";
import { useScores } from "../../store/scores";
import { logger } from "@/lib/logger";
import { COLORS, SP, TYPE, getProgressForStep, RADII } from "@/lib/tokens";

const ACCENT = COLORS.accent;
const ACCENT_LIGHT = COLORS.accentLight;
const TEXT = COLORS.text;
const TEXT_DIM = COLORS.dim;
const CARD_BORDER = COLORS.cardBorder;
const BG = COLORS.bgBottom;

function toFileUri(u: string) {
  if (u.startsWith("file://") || u.startsWith("http")) return u;
  if (u.startsWith("/")) return `file://${u}`;
  return u;
}

async function ensureFileUriAsync(raw?: string | null): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("content://")) {
    const dest = `${FileSystem.cacheDirectory}capture_${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: raw, to: dest });
      return dest;
    } catch {
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

type Step = "intro" | "review";
type Pose = "frontal" | "side";

function LimeButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
}) {
  const DEPTH = 5;
  if (disabled) {
    return (
      <Pressable
        onPress={onPress}
        disabled
        style={[
          {
            alignSelf: "center",
            width: "86%",
            borderRadius: RADII.pill,
            paddingVertical: SP[4],
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.10)",
          },
          style,
        ]}
      >
        <Text style={{ color: TEXT_DIM, ...TYPE.bodySemiBold }}>
          {title}
        </Text>
      </Pressable>
    );
  }
  return (
    <View
      style={[
        {
          alignSelf: "center",
          width: "86%",
          borderRadius: RADII.pill,
          backgroundColor: COLORS.accentDepth,
          paddingBottom: DEPTH,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          borderRadius: RADII.pill,
          paddingVertical: SP[4],
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ACCENT,
          transform: [{ translateY: pressed ? DEPTH - 1 : 0 }],
        })}
      >
        <Text style={{ color: BG, ...TYPE.bodySemiBold }}>{title}</Text>
      </Pressable>
    </View>
  );
}

function ChooserModal({
  visible,
  pose,
  onCamera,
  onGallery,
  onClose,
}: {
  visible: boolean;
  pose: Pose;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: "#1A1A1A",
            borderTopLeftRadius: RADII.xl,
            borderTopRightRadius: RADII.xl,
            padding: SP[6],
            gap: SP[3],
            borderWidth: 1,
            borderColor: CARD_BORDER,
          }}
        >
          <Text
            style={{
              ...TYPE.button,
              color: TEXT,
              textAlign: "center",
              marginBottom: 2,
            }}
          >
            {pose === "frontal" ? "Take Frontal Photo" : "Take Side Photo"}
          </Text>
          <Text
            style={{
              ...TYPE.caption,
              color: TEXT_DIM,
              textAlign: "center",
              marginBottom: SP[2],
            }}
          >
            {pose === "frontal"
              ? "Face the camera directly. Neutral expression, good lighting."
              : "Turn 90° to the side. Keep your chin level, good lighting."}
          </Text>
          <LimeButton title="Take Photo" onPress={onCamera} />
          <Pressable onPress={onGallery} style={{ alignSelf: "center", marginTop: 4 }}>
            <Text style={{ color: ACCENT, ...TYPE.bodySemiBold, fontSize: 15 }}>
              Pick From Gallery
            </Text>
          </Pressable>
          <View style={{ height: SP[2] }} />
        </View>
      </Pressable>
    </Modal>
  );
}

export default function OnboardingFaceScan() {
  const [perm, requestPerm] = useCameraPermissions();
  const permissionDenied = perm?.granted === false;

  const [step, setStep] = useState<Step>("intro");
  const [pose, setPose] = useState<Pose>("frontal");
  const [frontalUri, setFrontalUri] = useState<string | null>(null);
  const [sideUri, setSideUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const window = useWindowDimensions();
  const headingFontSize = window.width >= 420 ? 34 : window.width >= 360 ? 30 : 28;
  const progress = getProgressForStep("face-scan");

  const handleChosen = async (uri: string | null) => {
    if (!uri) return;
    try {
      const normalized = await ensureFileUriAsync(uri);
      if (!normalized) throw new Error("Bad photo path");
      if (pose === "frontal") {
        setFrontalUri(normalized);
        setPose("side");
        setChooserOpen(true); // immediately open chooser for side
      } else {
        setSideUri(normalized);
        setStep("review");
      }
    } catch (e) {
      logger.error("[SCAN] normalize failed", e);
      Alert.alert("File error", "Could not use the selected photo.");
    }
  };

  const changePose = (nextPose: Pose) => {
    setPose(nextPose);
    setChooserOpen(true);
  };

  const pickFromGallery = async () => {
    setChooserOpen(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) await handleChosen(res.assets?.[0]?.uri || null);
  };

  const startCamera = async () => {
    setChooserOpen(false);
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) {
        Alert.alert("Permission needed", "Camera permission is required.");
        return;
      }
    }
    setCameraOpen(true);
  };

  const capture = async () => {
    try {
      const cam: any = cameraRef.current;
      const photo =
        (await cam?.takePictureAsync?.({ quality: 1, skipProcessing: false })) ||
        (await cam?.takePhoto?.({ quality: 1 })) ||
        null;
      const raw = photo?.uri ?? photo?.path ?? photo?.assets?.[0]?.uri;
      await handleChosen(raw || null);
    } catch (e: any) {
      Alert.alert("Camera error", String(e?.message || e));
    } finally {
      setCameraOpen(false);
    }
  };

  const canContinue = !!frontalUri && !!sideUri && !submitting;

  const beginScan = () => {
    setFrontalUri(null);
    setSideUri(null);
    setPose("frontal");
    setChooserOpen(true);
  };

  const handleAnalyze = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    try {
      const fResolved = await ensureFileUriAsync(frontalUri!);
      const sResolved = await ensureFileUriAsync(sideUri!);
      if (!fResolved || !sResolved) throw new Error("Could not read selected photos.");

      // Sequential: compress then immediately persist each photo before the next
      // ImageManipulator call. Running both in parallel on Android can cause the
      // first temp file to be evicted from the ImageManipulator cache before we copy it.
      let fNorm, sNorm;
      try {
        fNorm = await persistCompressedResult(await ensureJpegCompressed(fResolved));
        sNorm = await persistCompressedResult(await ensureJpegCompressed(sResolved));
      } catch {
        throw new Error(
          "Couldn't load one of your photos. Please retake or pick a different image."
        );
      }

      // Fire and forget — result tracked via useScores store
      useScores
        .getState()
        .analyzePair(
          { uri: fNorm.uri, name: fNorm.name, mime: "image/jpeg" },
          { uri: sNorm.uri, name: sNorm.name, mime: "image/jpeg" }
        )
        .catch(() => {});

      router.push("/(onboarding)/trust");
    } catch (err) {
      logger.error("[SCAN] analyze failed", err);
      Alert.alert(
        "Photo Error",
        toUserFacingMessage(err, "Something went wrong with your photos. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const CameraModal = () => (
    <Modal
      visible={cameraOpen}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => setCameraOpen(false)}
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {permissionDenied ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: TEXT, marginBottom: 12 }}>Camera permission required.</Text>
            <LimeButton title="Grant Permission" onPress={() => void requestPerm()} />
            <Pressable onPress={() => setCameraOpen(false)} style={{ marginTop: 10 }}>
              <Text style={{ color: TEXT_DIM }}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} active={true} facing="front" style={{ flex: 1 }} />
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: SP[5],
                backgroundColor: "rgba(0,0,0,0.35)",
                flexDirection: "row",
                justifyContent: "center",
              }}
            >
              <Pressable
                onPress={capture}
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 41,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: "rgba(255,255,255,0.6)",
                }}
              >
                <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: "#fff" }} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );

  /* ---- INTRO ---- */
  if (step === "intro") {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={{ paddingHorizontal: SP[6], marginTop: SP[3] }}>
            <Text
              style={{
                color: TEXT,
                fontFamily: "Poppins-SemiBold",
                fontSize: headingFontSize,
                lineHeight: headingFontSize + 6,
                letterSpacing: -0.3,
              }}
            >
              Scan Your Face
            </Text>
            <Text
              style={{
                ...TYPE.body,
                color: TEXT_DIM,
                fontSize: 15,
                marginTop: SP[1] + 2,
              }}
            >
              Two photos — frontal and side — for your full facial analysis
            </Text>
          </View>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP[5] }}>
            <View style={{ width: "100%", maxWidth: 400, borderRadius: 24, overflow: "hidden", backgroundColor: "#000" }}>
              <View style={{ width: "100%", aspectRatio: 0.85, backgroundColor: "#000", overflow: "hidden" }}>
                <Image
                  source={require("../../assets/scanimage.jpeg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </View>

              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.75)", "#000000"]}
                locations={[0, 0.5, 1]}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" }}
                pointerEvents="none"
              />

              <View style={{ paddingHorizontal: SP[5], paddingBottom: SP[6], alignItems: "center", marginTop: -SP[4] }}>
                <Text
                  style={{
                    ...TYPE.h3,
                    color: TEXT,
                    textAlign: "center",
                    letterSpacing: -0.3,
                    marginBottom: SP[4] + 2,
                  }}
                >
                  Get your accurate{"\n"}facial score
                </Text>

                <View
                  style={{
                    width: "88%",
                    borderRadius: RADII.pill,
                    backgroundColor: COLORS.accentDepth,
                    paddingBottom: SP[1] + 2,
                    shadowColor: ACCENT,
                    shadowOpacity: 0.5,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 12,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      beginScan();
                    }}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      height: 56,
                      borderRadius: RADII.pill,
                      overflow: "hidden",
                      transform: [{ translateY: pressed ? 5 : 0 }],
                    })}
                  >
                    <LinearGradient
                      colors={[ACCENT_LIGHT, ACCENT]}
                      locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: RADII.pill }}
                    >
                      <Text style={{ ...TYPE.button, color: BG }}>
                        Begin Scan
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>

        <ChooserModal
          visible={chooserOpen}
          pose={pose}
          onCamera={startCamera}
          onGallery={pickFromGallery}
          onClose={() => setChooserOpen(false)}
        />
        <CameraModal />
      </View>
    );
  }

  /* ---- REVIEW ---- */
  return (
    <>
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[styles.progressTrack, { width: "92%", alignSelf: "center" }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={{ flex: 1, alignItems: "center", paddingHorizontal: SP[5] }}>
            <Text style={{ ...TYPE.h4, color: TEXT, marginTop: SP[4], marginBottom: SP[1] + 2 }}>
              Review your photos
            </Text>
            <Text style={{ ...TYPE.caption, color: TEXT_DIM, textAlign: "center", marginBottom: SP[5] }}>
              Make sure your face is clearly visible and well-lit
            </Text>

            <View style={{ width: "92%", flexDirection: "row", justifyContent: "space-between", gap: SP[3] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.captionMedium, color: TEXT_DIM, marginBottom: SP[1] + 2 }}>Frontal</Text>
                <View style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: RADII.md, overflow: "hidden", borderWidth: 1.5, borderColor: CARD_BORDER, backgroundColor: "#000" }}>
                  <Image source={{ uri: frontalUri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
                <Pressable onPress={() => changePose("frontal")} style={{ marginTop: SP[2] + 2 }}>
                  <Text style={{ ...TYPE.captionSemiBold, color: ACCENT }}>Retake</Text>
                </Pressable>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.captionMedium, color: TEXT_DIM, marginBottom: SP[1] + 2 }}>Side</Text>
                <View style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: RADII.md, overflow: "hidden", borderWidth: 1.5, borderColor: CARD_BORDER, backgroundColor: "#000" }}>
                  <Image source={{ uri: sideUri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
                <Pressable onPress={() => changePose("side")} style={{ marginTop: SP[2] + 2 }}>
                  <Text style={{ ...TYPE.captionSemiBold, color: ACCENT }}>Retake</Text>
                </Pressable>
              </View>
            </View>

            <LimeButton
              title={submitting ? "Processing…" : "Analyze My Face"}
              onPress={handleAnalyze}
              disabled={!canContinue}
              style={{ marginTop: SP[7], width: "92%" }}
            />
          </View>
        </SafeAreaView>
      </View>

      <ChooserModal
        visible={chooserOpen}
        pose={pose}
        onCamera={startCamera}
        onGallery={pickFromGallery}
        onClose={() => setChooserOpen(false)}
      />
      <CameraModal />
    </>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    width: "92%",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginTop: SP[3],
    marginBottom: SP[2],
    alignSelf: "center",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },
});
