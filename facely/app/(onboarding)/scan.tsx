// app/(onboarding)/scan.tsx
// Onboarding face scan — captures frontal + side photos and stores them for analysis
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
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import Svg, { Line, Ellipse } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ensureJpegCompressed } from "@/lib/api/media";
import { useOnboarding } from "@/store/onboarding";
import { logger } from "@/lib/logger";

const ACCENT = "#B4F34D";
const ACCENT_LIGHT = "#CCFF6B";
const TEXT = "#FFFFFF";
const TEXT_DIM = "rgba(255,255,255,0.72)";
const BG = "#0B0B0B";

type Step = "intro" | "review";

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
  result: T
): Promise<T> {
  const dir = await ensurePersistentImageDir();
  const filename = `${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
  const dest = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return { ...result, uri: dest };
}

/* ───────────────────────── face mesh ───────────────────────── */
function FaceMeshOverlay({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  const ROWS = 12;
  const COLS = 8;
  type Pt = { x: number; y: number } | null;
  const grid: Pt[][] = [];
  for (let r = 0; r <= ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c <= COLS; c++) {
      const nx = (c / COLS) * 2 - 1;
      const ny = (r / ROWS) * 2 - 1;
      grid[r][c] = nx * nx + ny * ny <= 0.95 ? { x: cx + nx * rx, y: cy + ny * ry } : null;
    }
  }
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const p = grid[r]?.[c];
      if (!p) continue;
      const pr = grid[r]?.[c + 1];
      if (pr) lines.push({ x1: p.x, y1: p.y, x2: pr.x, y2: pr.y });
      const pb = grid[r + 1]?.[c];
      if (pb) lines.push({ x1: p.x, y1: p.y, x2: pb.x, y2: pb.y });
      const pd = grid[r + 1]?.[c + 1];
      if (pd) lines.push({ x1: p.x, y1: p.y, x2: pd.x, y2: pd.y });
    }
  }
  return (
    <>
      {lines.map((l, i) => (
        <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,0.22)" strokeWidth={0.7} />
      ))}
    </>
  );
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
  const window = useWindowDimensions();

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
        // immediately open camera again for the side shot
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

  /* ── camera modal — always mounted so it can open from any step ── */
  const cameraModal = (
    <Modal visible={cameraOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {permissionDenied ? (
          <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: TEXT, marginBottom: 12, textAlign: "center", paddingHorizontal: 32 }}>
              Camera permission is required to analyze your face.
            </Text>
            <Pressable onPress={() => void requestPerm()} style={{ backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
              <Text style={{ color: BG, fontFamily: "Poppins-SemiBold" }}>Grant Permission</Text>
            </Pressable>
            <Pressable onPress={() => setCameraOpen(false)} style={{ marginTop: 16 }}>
              <Text style={{ color: TEXT_DIM }}>Close</Text>
            </Pressable>
          </SafeAreaView>
        ) : (
          <>
            <CameraView ref={cameraRef} active={cameraOpen} facing="front" style={StyleSheet.absoluteFill} />
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={window.width} height={window.height}>
              <FaceMeshOverlay cx={window.width / 2} cy={window.height * 0.42} rx={window.width * 0.33} ry={window.height * 0.27} />
              <Ellipse cx={window.width / 2} cy={window.height * 0.42} rx={window.width * 0.33} ry={window.height * 0.27} stroke="#4DD9FF" strokeWidth={3} fill="none" />
            </Svg>

            {/* Top instruction card */}
            <View pointerEvents="none" style={{ position: "absolute", top: 52, left: 20, right: 20, backgroundColor: "rgba(38,34,28,0.86)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18, alignItems: "center" }}>
              <View style={{ width: 38, height: 38, marginBottom: 10, position: "relative" }}>
                {[
                  { top: 0, left: 0, bT: true, bL: true },
                  { top: 0, right: 0, bT: true, bR: true },
                  { bottom: 0, left: 0, bB: true, bL: true },
                  { bottom: 0, right: 0, bB: true, bR: true },
                ].map((c, i) => (
                  <View key={i} style={{ position: "absolute", width: 12, height: 12, top: c.top ?? undefined, left: c.left ?? undefined, right: (c as any).right ?? undefined, bottom: c.bottom ?? undefined, borderTopWidth: c.bT ? 2.5 : 0, borderLeftWidth: c.bL ? 2.5 : 0, borderRightWidth: (c as any).bR ? 2.5 : 0, borderBottomWidth: c.bB ? 2.5 : 0, borderColor: "#fff" }} />
                ))}
              </View>
              <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Poppins-SemiBold", marginBottom: 4 }}>
                {pose === "frontal" ? "Face Forward" : "Turn to Your Side"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, fontFamily: "Poppins-Regular", textAlign: "center" }}>
                {pose === "frontal" ? "Center your face, neutral expression" : "Align your profile with the oval"}
              </Text>
              {/* step dots */}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: (pose === "frontal" ? i === 0 : i === 1) ? ACCENT : "rgba(255,255,255,0.25)" }} />
                ))}
              </View>
            </View>

            {/* Bottom controls */}
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 44, alignItems: "center", gap: 20 }}>
              <Pressable
                onPress={capture}
                style={({ pressed }) => ({ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: "rgba(255,255,255,0.45)", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", transform: [{ scale: pressed ? 0.93 : 1 }] })}
              >
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff" }} />
              </Pressable>
              <Pressable
                onPress={pickFromGallery}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11, opacity: pressed ? 0.65 : 1 })}
              >
                <View style={{ width: 18, height: 18, flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
                  {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.7)" }} />)}
                </View>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Poppins-Regular" }}>Choose from Library</Text>
              </Pressable>
              <Pressable onPress={() => setCameraOpen(false)}>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "Poppins-Regular" }}>Skip for now</Text>
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
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" />
        {cameraModal}
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
            <View style={{ width: "100%", maxWidth: 400, borderRadius: 24, overflow: "hidden", backgroundColor: "#000" }}>
              {/* Face image */}
              <View style={{ width: "100%", aspectRatio: 0.85, backgroundColor: "#000", overflow: "hidden" }}>
                <Image
                  source={require("../../assets/scanimage.jpeg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </View>
              {/* Gradient fade */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.80)", "#000000"]}
                locations={[0, 0.45, 1]}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }}
                pointerEvents="none"
              />
              {/* Content */}
              <View style={{ paddingHorizontal: 20, paddingBottom: 24, alignItems: "center", marginTop: -20 }}>
                <Text style={styles.introTitle}>Now let's analyze{"\n"}your face</Text>
                <Text style={styles.introSubtitle}>
                  Takes 10 seconds. You'll see your scores right after.{"\n"}Your data stays private forever.
                </Text>

                <View style={styles.ctaShadow}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); beginScan(); }}
                    style={({ pressed }) => [styles.ctaInner, { transform: [{ translateY: pressed ? 5 : 0 }] }]}
                  >
                    <LinearGradient colors={[ACCENT_LIGHT, ACCENT]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.ctaGradient}>
                      <Text style={styles.ctaText}>Analyze My Potential</Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                <Pressable onPress={skipScan} style={{ marginTop: 16, alignItems: "center" }}>
                  <Text style={styles.skipLabel}>Skip scan for now</Text>
                  <Text style={styles.skipSub}>You can always do it later</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── review ── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      {cameraModal}
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
        <Text style={styles.reviewTitle}>Review your photos</Text>

        <View style={{ width: "92%", flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          {([
            { label: "Frontal", uri: frontalUri, p: "frontal" as const },
            { label: "Side", uri: sideUri, p: "side" as const },
          ]).map(({ label, uri, p }) => (
            <View key={label} style={{ flex: 1 }}>
              <Text style={{ color: TEXT_DIM, marginBottom: 6, fontFamily: "Poppins-Regular", fontSize: 13 }}>{label}</Text>
              <View style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#111" }}>
                {uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
              </View>
              <Pressable onPress={() => retake(p)} style={{ marginTop: 10 }}>
                <Text style={{ color: ACCENT, fontFamily: "Poppins-SemiBold", fontSize: 13 }}>Retake</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={[styles.ctaShadow, { marginTop: 22, width: "92%" }]}>
          <Pressable
            onPress={submitPhotos}
            disabled={!frontalUri || !sideUri || submitting}
            style={({ pressed }) => [styles.ctaInner, { transform: [{ translateY: pressed ? 5 : 0 }], opacity: submitting ? 0.7 : 1 }]}
          >
            <LinearGradient colors={[ACCENT_LIGHT, ACCENT]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.ctaGradient}>
              <Text style={styles.ctaText}>{submitting ? "Preparing…" : "Analyze My Potential"}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  introTitle: {
    color: TEXT,
    textAlign: "center",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  introSubtitle: {
    color: TEXT_DIM,
    textAlign: "center",
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },
  ctaShadow: {
    width: "88%",
    borderRadius: 28,
    backgroundColor: "#6B9A1E",
    paddingBottom: 6,
    shadowColor: ACCENT,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  ctaInner: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  ctaGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  ctaText: {
    color: BG,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 17,
  },
  skipLabel: {
    color: TEXT_DIM,
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
  },
  skipSub: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  reviewTitle: {
    color: TEXT,
    fontSize: 20,
    marginBottom: 14,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
  },
});
