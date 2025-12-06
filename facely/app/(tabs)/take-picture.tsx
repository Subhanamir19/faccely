// C:\SS\facely\app\(tabs)\take-picture.tsx
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
  ImageBackground,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import Svg, { Line, Circle, Rect, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useScores } from "../../store/scores";
import useMetricSizing from "@/components/layout/useMetricSizing";

// NEW: shared pre-upload compressor (JPEG, max 1080px)
import { ensureJpegCompressed } from "../../lib/api/media";

/* ============================== TOKENS ============================== */
const ACCENT = "#B4F34D"; // Sigma Max lime
const TEXT = "#FFFFFF";
const TEXT_DIM = "rgba(255,255,255,0.72)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const BG = "#0B0B0B";

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


/* ============================== UI ============================== */
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          alignSelf: "center",
          width: "86%",
          borderRadius: 26,
          paddingVertical: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: disabled ? "rgba(255,255,255,0.10)" : ACCENT,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          color: disabled ? TEXT_DIM : BG,

          fontSize: 16,
          fontFamily: Platform.select({
            ios: "Poppins-SemiBold",
            android: "Poppins-SemiBold",
            default: "Poppins-SemiBold",
          }),
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* A rounded neon frame with soft glow, sized by parent using absolute fill */
function NeonFrame() {
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 22,
          borderWidth: 2,
          borderColor: ACCENT,
        }}
      />
      {/* glow */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 22,
          shadowColor: ACCENT,
          shadowOpacity: 0.6,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          ...(Platform.OS === "android"
            ? { borderWidth: 0.1, borderColor: "transparent", elevation: 6 }
            : null),
        }}
      />
    </>
  );
}

/* SVG overlays for alignment */
function FrontalGuides({ w, h }: { w: number; h: number }) {
  const pad = 16;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <Svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <Rect x={pad} y={pad} width={innerW} height={innerH} rx={20} ry={20} stroke={ACCENT} strokeOpacity={0.35} fill="none" />
      <Line x1={cx} y1={pad + 6} x2={cx} y2={h - pad - 6} stroke={ACCENT} strokeWidth={2} strokeOpacity={0.7} />
      <Line x1={pad + 10} y1={cy - innerH * 0.08} x2={w - pad - 10} y2={cy - innerH * 0.08} stroke={ACCENT} strokeWidth={2} strokeOpacity={0.4} />
      <Circle cx={cx} cy={cy + innerH * 0.05} r={innerW * 0.08} stroke={ACCENT} strokeWidth={2} strokeOpacity={0.5} fill="none" />
      <Path
        d={`
          M ${cx} ${pad + 18}
          C ${cx + innerW * 0.26} ${pad + innerH * 0.22}, ${cx + innerW * 0.26} ${h - pad - innerH * 0.18}, ${cx} ${h - pad - 10}
          C ${cx - innerW * 0.26} ${h - pad - innerH * 0.18}, ${cx - innerW * 0.26} ${pad + innerH * 0.22}, ${cx} ${pad + 18}
        `}
        stroke={ACCENT}
        strokeOpacity={0.28}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

function SideGuides({ w, h }: { w: number; h: number }) {
  const pad = 16;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const cx = w / 2;
  return (
    <Svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <Rect x={pad} y={pad} width={innerW} height={innerH} rx={20} ry={20} stroke={ACCENT} strokeOpacity={0.35} fill="none" />
      <Line x1={cx} y1={pad + 6} x2={cx} y2={h - pad - 6} stroke={ACCENT} strokeWidth={2} strokeOpacity={0.7} />
      <Line x1={cx - innerW * 0.18} y1={pad + innerH * 0.36} x2={cx + innerW * 0.28} y2={pad + innerH * 0.36} stroke={ACCENT} strokeWidth={2} strokeOpacity={0.4} />
      <Path
        d={`
          M ${cx + innerW * 0.24} ${pad + innerH * 0.72}
          Q ${cx + innerW * 0.10} ${pad + innerH * 0.86}, ${cx - innerW * 0.02} ${pad + innerH * 0.74}
        `}
        stroke={ACCENT}
        strokeOpacity={0.45}
        strokeWidth={2}
        fill="none"
      />
      <Circle cx={cx + innerW * 0.08} cy={pad + innerH * 0.38} r={5} fill={ACCENT} />
    </Svg>
  );
}

/* ============================== SCREEN ============================== */
export default function TakePicture() {
  const scoresStore = useScores() as any;

  const [perm, requestPerm] = useCameraPermissions();
  const permissionDenied = perm?.granted === false;

  const [step, setStep] = useState<Step>("intro");
  const [pose, setPose] = useState<"frontal" | "side">("frontal");
  const [frontalUri, setFrontalUri] = useState<string | null>(null);
  const [sideUri, setSideUri] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const window = useWindowDimensions();
  const sizing = useMetricSizing();

  const isShortScreen = window.height < 760;

  const cardWidth = sizing.cardWidth;
  const CARD_BASE_WIDTH = 1032;
  const cardScale = cardWidth / CARD_BASE_WIDTH;

  // taller card on short screens so text + button can coexist
  const cardHeight =
    cardWidth * (isShortScreen ? 1.36 : 1.24);

  // slightly narrower CTA, scaled height/radius
  const ctaWidth = Math.min(cardWidth * 0.74, 420);
  const ctaHeight = Math.max(50, 88 * cardScale);
  const ctaRadius = Math.max(24, 44 * cardScale);

  const gridCell = Math.max(60, 80 * cardScale);

  const headingFontSize = window.width >= 420 ? 34 : window.width >= 360 ? 30 : 28;

  // capture selection
  const handleChosen = async (uri: string | null) => {
    if (!uri) return;
    try {
      const normalized = await ensureFileUriAsync(uri);
      if (!normalized) throw new Error("Bad photo path");
      if (pose === "frontal") {
        setFrontalUri(normalized);
        setPose("side");
        setStep("capture");
      } else {
        setSideUri(normalized);
        setStep("review");
      }
    } catch (e) {
      console.error("[PIC] normalize failed", e);
      Alert.alert("File error", "Could not use the selected photo.");
    }
  };

  const changePose = (nextPose: "frontal" | "side") => {
    setPose(nextPose);
    setStep("capture");
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
    setStep("capture");
  };

  const goToAnalysis = () => {
    router.push("/(tabs)/analysis");
  };

  const goToHistory = () => {
    router.push("/(tabs)/history");
  };

  const useBoth = async () => {
    console.log("[PIC] Proceed tapped", { frontalUri, sideUri });
    if (!canContinue) {
      console.warn("[PIC] blocked: canContinue=false", { frontalUri, sideUri, submitting });
      return;
    }

    setSubmitting(true);

    try {
      const fResolved = await ensureFileUriAsync(frontalUri!);
      const sResolved = await ensureFileUriAsync(sideUri!);
      if (!fResolved || !sResolved) throw new Error("Could not read selected photos.");

      const [frontInfo, sideInfo] = await Promise.all([
        FileSystem.getInfoAsync(fResolved),
        FileSystem.getInfoAsync(sResolved),
      ]);

      if (!frontInfo.exists || !sideInfo.exists) {
        console.warn("[PIC] missing file(s)", {
          frontExists: frontInfo.exists,
          sideExists: sideInfo.exists,
          fResolved,
          sResolved,
        });
        Alert.alert("Photos missing", "Please retake or reselect your photos.");
        return;
      }

      const [fNormTemp, sNormTemp] = await Promise.all([
        ensureJpegCompressed(fResolved),
        ensureJpegCompressed(sResolved),
      ]);
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
      console.error("[PIC] proceed failed", err);
      Alert.alert("Couldn't proceed", toUserFacingMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renderGridOverlay = () => {
    const verticalCount = Math.floor(cardWidth / gridCell);
    const horizontalCount = Math.floor(cardHeight / gridCell);
    const verticalLines = Array.from({ length: Math.max(0, verticalCount - 1) });
    const horizontalLines = Array.from({ length: Math.max(0, horizontalCount - 1) });

    return (
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          opacity: 0.1,
        }}
      >
        {verticalLines.map((_, i) => {
          const left = ((i + 1) * gridCell) / cardWidth;
          return (
            <View
              key={`v-${i}`}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${left * 100}%`,
                width: 2,
                backgroundColor: "#FFFFFF",
              }}
            />
          );
        })}
        {horizontalLines.map((_, i) => {
          const top = ((i + 1) * gridCell) / cardHeight;
          return (
            <View
              key={`h-${i}`}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${top * 100}%`,
                height: 2,
                backgroundColor: "#FFFFFF",
              }}
            />
          );
        })}
      </View>
    );
  };

  const renderIntro = () => (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: 24,
              marginTop: 36,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: Platform.select({
                  ios: "Poppins-SemiBold",
                  android: "Poppins-SemiBold",
                  default: "Poppins-SemiBold",
                }),
                fontSize: headingFontSize,
                lineHeight: headingFontSize + 6,
                letterSpacing: -0.3,
              }}
            >
              Face scan
            </Text>
            <Pressable onPress={goToAnalysis} hitSlop={16}>
              <Text
                style={{
                  color: "#FFFFFF",
                fontFamily: Platform.select({
                  ios: "Poppins-SemiBold",
                  android: "Poppins-SemiBold",
                  default: "Poppins-SemiBold",
                }),
                fontSize: headingFontSize,
                lineHeight: headingFontSize + 6,
                letterSpacing: -0.3,
              }}
            >
              Analysis
            </Text>
          </Pressable>
          </View>

          <Pressable onPress={goToHistory} hitSlop={12} style={{ alignSelf: "flex-end", marginRight: 24, marginTop: 8 }}>
            <Text
              style={{
                color: TEXT,
                fontFamily: Platform.select({
                  ios: "Poppins-Regular",
                  android: "Poppins-Regular",
                  default: "Poppins-Regular",
                }),
                fontSize: 14,
              }}
            >
              History
            </Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                marginTop: 18,
                width: cardWidth,
                height: cardHeight,
                borderRadius: 36,
                backgroundColor: "#121212",
                overflow: "hidden",
                paddingHorizontal: 24,
                paddingVertical: 22 * cardScale,
              }}
            >
              <LinearGradient
                colors={["#151515", "#0A0A0A"]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {renderGridOverlay()}

              <View style={{ gap: 10, marginTop: 10 }}>
                <Text
                  style={{
                    color: "#FFFFFF",
                    textAlign: "left",
                    fontFamily: Platform.select({
                      ios: "Poppins-SemiBold",
                      android: "Poppins-SemiBold",
                      default: "Poppins-SemiBold",
                    }),
                    fontSize: Math.max(26, 34 * cardScale),
                    lineHeight: Math.max(32, 40 * cardScale),
                    letterSpacing: -0.36,
                  }}
                >
                  Get ready for a guided face scan
                </Text>
                <Text
                  style={{
                    color: TEXT_DIM,
                    fontFamily: Platform.select({
                      ios: "Poppins-Regular",
                      android: "Poppins-Regular",
                      default: "Poppins-Regular",
                    }),
                    fontSize: 14,
                    lineHeight: 19,
                  }}
                >
                  We’ll walk you through two quick photos—first frontal, then your side profile.
                </Text>
              </View>

              <View
                style={{
                  marginTop: 24,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    backgroundColor: "rgba(19,19,19,0.72)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Text
                    style={{
                      color: TEXT_DIM,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontFamily: Platform.select({
                        ios: "Poppins-SemiBold",
                        android: "Poppins-SemiBold",
                        default: "Poppins-SemiBold",
                      }),
                    }}
                  >
                    Step 1
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      marginTop: 6,
                      fontSize: 18,
                      fontFamily: Platform.select({
                        ios: "Poppins-SemiBold",
                        android: "Poppins-SemiBold",
                        default: "Poppins-SemiBold",
                      }),
                    }}
                  >
                    Frontal photo
                  </Text>
                  <Text
                    style={{
                      color: TEXT_DIM,
                      marginTop: 8,
                    fontSize: 13,
                    lineHeight: 17,
                    fontFamily: Platform.select({
                      ios: "Poppins-Regular",
                      android: "Poppins-Regular",
                      default: "Poppins-Regular",
                    }),
                  }}
                >
                  Center your face within the guide for the sharpest read.
                </Text>
              </View>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    backgroundColor: "rgba(19,19,19,0.48)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Text
                    style={{
                      color: TEXT_DIM,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontFamily: Platform.select({
                        ios: "Poppins-SemiBold",
                        android: "Poppins-SemiBold",
                        default: "Poppins-SemiBold",
                      }),
                    }}
                  >
                    Step 2
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      marginTop: 6,
                      fontSize: 18,
                      fontFamily: Platform.select({
                        ios: "Poppins-SemiBold",
                        android: "Poppins-SemiBold",
                        default: "Poppins-SemiBold",
                      }),
                    }}
                  >
                    Side profile
                  </Text>
                  <Text
                    style={{
                      color: TEXT_DIM,
                      marginTop: 8,
                    fontSize: 13,
                    lineHeight: 17,
                    fontFamily: Platform.select({
                      ios: "Poppins-Regular",
                      android: "Poppins-Regular",
                      default: "Poppins-Regular",
                    }),
                    }}
                  >
                    Turn your head slightly right so we can analyze your profile.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={beginScan}
                hitSlop={8}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: (cardWidth - ctaWidth) / 2,
                  right: (cardWidth - ctaWidth) / 2,
                  bottom: 48 * cardScale,
                  height: ctaHeight,
                  borderRadius: ctaRadius,
                  backgroundColor: "#B4F34D",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  shadowColor: "#000",
                  shadowOpacity: 0.45,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 10,
                })}
              >
                <Text
                  style={{
                    color: BG,
                    fontFamily: Platform.select({
                      ios: "Poppins-SemiBold",
                      android: "Poppins-SemiBold",
                      default: "Poppins-SemiBold",
                    }),
                    fontSize: Math.max(17, 22 * cardScale),
                    lineHeight: Math.max(22, 28 * cardScale),
                  }}
                >
                  Begin scan
                </Text>
              </Pressable>
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
    <ImageBackground
      source={require("../../assets/bg/score-bg.jpg")}
      style={{ flex: 1, backgroundColor: BG }}
      imageStyle={{ transform: [{ translateY: 40 }] }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
          <Text
            style={{
              color: TEXT,
              fontSize: 24,
              lineHeight: 28,
              marginBottom: 16,
              fontFamily: Platform.select({
                ios: "Poppins-SemiBold",
                android: "Poppins-SemiBold",
                default: "Poppins-SemiBold",
              }),
            }}
          >
            {title}
          </Text>

          {/* Card with neon frame + guide image */}
          <View
            style={{
              width: "86%",
              aspectRatio: 3 / 4,
              borderRadius: 22,
              overflow: "hidden",
              position: "relative",
              backgroundColor: "#000",
              marginTop: 6, // tiny visual offset so it feels perfectly centered
            }}
          >
            <Image source={guideSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <NeonFrame />
            {overlay === "frontal" ? (
              <FrontalGuides w={Math.round((360 / 4) * 3)} h={480} />
            ) : (
              <SideGuides w={Math.round((360 / 4) * 3)} h={480} />
            )}
          </View>

          <Text
            style={{
              marginTop: 12,
              color: TEXT_DIM,
              fontSize: 13,
              fontFamily: Platform.select({
                ios: "Poppins-Regular",
                android: "Poppins-Regular",
                default: "Poppins-Regular",
              }),
            }}
          >
            Align your face with the guides. Good lighting, neutral expression.
          </Text>

          <LimeButton title="Capture Photo" onPress={() => setChooserOpen(true)} style={{ marginTop: 18 }} />

          {/* dots */}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: overlay === "frontal" ? ACCENT : "rgba(255,255,255,0.25)",
              }}
            />
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: overlay === "side" ? ACCENT : "rgba(255,255,255,0.25)",
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  return (
    <>
      {step === "intro" && renderIntro()}
      {step === "capture" &&
        renderGuide({
          guideSrc:
            pose === "frontal"
              ? require("../../assets/capture-guides/frontal-guide.jpg")
              : require("../../assets/capture-guides/side-guide.jpg"),
          title: pose === "frontal" ? "Take Frontal Photo" : "Take Side Photo",
          overlay: pose,
        })}

      {step === "review" && (
        <ImageBackground
          source={require("../../assets/bg/score-bg.jpg")}
          style={{ flex: 1, backgroundColor: BG }}
          imageStyle={{ transform: [{ translateY: 40 }] }}
        >
          <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
            <Text
              style={{
                color: TEXT,
                fontSize: 20,
                marginBottom: 14,
                fontFamily: Platform.select({
                  ios: "Poppins-SemiBold",
                  android: "Poppins-SemiBold",
                  default: "Poppins-SemiBold",
                }),
              }}
            >
              Review your photos
            </Text>

            <View style={{ width: "92%", flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: TEXT_DIM, marginBottom: 6 }}>Frontal</Text>
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 3 / 4,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "#000",
                  }}
                >
                  <Image source={{ uri: frontalUri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
                <Pressable onPress={() => changePose("frontal")} style={{ marginTop: 10 }}>
                  <Text
                    style={{
                      color: ACCENT,
                      fontFamily: Platform.select({
                        ios: "Poppins-SemiBold",
                        android: "Poppins-SemiBold",
                        default: "Poppins-SemiBold",
                      }),
                    }}
                  >
                    Retake
                  </Text>
                </Pressable>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: TEXT_DIM, marginBottom: 6 }}>Side</Text>
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 3 / 4,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "#000",
                  }}
                >
                  <Image source={{ uri: sideUri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
                <Pressable onPress={() => changePose("side")} style={{ marginTop: 10 }}>
                  <Text
                    style={{
                      color: ACCENT,
                      fontFamily: Platform.select({
                        ios: "Poppins-SemiBold",
                        android: "Poppins-SemiBold",
                        default: "Poppins-SemiBold",
                      }),
                    }}
                  >
                    Retake
                  </Text>
                </Pressable>
              </View>
            </View>

            <LimeButton
              title={submitting ? "Analyzing…" : "Proceed to score"}
              onPress={useBoth}
              disabled={!canContinue}
              style={{ marginTop: 22, width: "92%" }}
            />
          </SafeAreaView>
        </ImageBackground>
      )}

      {/* Chooser modal */}
      <Modal transparent visible={chooserOpen} animationType="fade" onRequestClose={() => setChooserOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center" }} onPress={() => setChooserOpen(false)}>
          <View
            style={{
              marginHorizontal: 32,
              backgroundColor: "#1A1A1A",
              borderRadius: 16,
              padding: 20,
              gap: 12,
              borderWidth: 1,
              borderColor: CARD_BORDER,
            }}
          >
            <LimeButton title="Take Photo" onPress={startCamera} />
            <Pressable onPress={pickFromGallery} style={{ alignSelf: "center", marginTop: 6 }}>
              <Text
                style={{
                  color: ACCENT,
                  fontFamily: Platform.select({
                    ios: "Poppins-SemiBold",
                    android: "Poppins-SemiBold",
                    default: "Poppins-SemiBold",
                  }),
                }}
              >
                Pick From Gallery
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Camera modal */}
      <Modal visible={cameraOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
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
                  padding: 20,
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
