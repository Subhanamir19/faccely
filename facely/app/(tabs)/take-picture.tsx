// app/(tabs)/take-picture.tsx
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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import Svg, { Line, Circle, Rect, Path } from "react-native-svg";
import { useScores } from "../../store/scores";

/* ============================== TOKENS ============================== */
const ACCENT = "#8FA31E"; // neon lime
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_DIM = "rgba(255,255,255,0.65)";
const CARD_BORDER = "rgba(255,255,255,0.12)";
const CARD_TINT = "rgba(15,15,15,0.72)";
const BG = "#0B0B0C";

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

/** Force-save as JPEG so the backend never sees HEIC/HEIF surprises. */
async function ensureJpeg(uri: string): Promise<string> {
  const lower = uri.toLowerCase();
  const alreadyJpeg = lower.endsWith(".jpg") || lower.endsWith(".jpeg");
  try {
    if (alreadyJpeg) return uri;
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
    );
    return toFileUri(out.uri);
  } catch {
    // If manipulation fails (rare), just return original URI
    return uri;
  }
}

type Step = "frontal" | "side" | "review";

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
          color: disabled ? TEXT_DIM : "#0D0E0D",
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

  const [step, setStep] = useState<Step>("frontal");
  const [frontalUri, setFrontalUri] = useState<string | null>(null);
  const [sideUri, setSideUri] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // capture selection
  const handleChosen = async (uri: string | null) => {
    if (!uri) return;
    const normalized = await ensureFileUriAsync(uri);
    if (!normalized) return;

    if (step === "frontal") {
      setFrontalUri(normalized);
      setStep("side");
    } else if (step === "side") {
      setSideUri(normalized);
      setStep("review");
    }
  };

  const changePose = (pose: "frontal" | "side") => {
    setStep(pose);
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

  const useBoth = async () => {
    if (!canContinue) return;
    try {
      setSubmitting(true);

      // Force both images to JPEG to avoid HEIC/HEIF issues on server
      const fJpeg = await ensureJpeg(frontalUri!);
      const sJpeg = await ensureJpeg(sideUri!);

      if (typeof scoresStore.analyzePair === "function") {
        const out = await scoresStore.analyzePair(fJpeg, sJpeg);
        if (!out) {
          Alert.alert("Analysis failed", "No scores were returned from backend.");
          return;
        }
        router.push({
          pathname: "/(tabs)/score",
          params: { scoresPayload: JSON.stringify(out) },
        });
      } else {
        Alert.alert(
          "Next step needed",
          "Implement useScores.analyzePair(frontUri, sideUri) to send both images together."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

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
      {step === "frontal" &&
        renderGuide({
          guideSrc: require("../../assets/capture-guides/frontal-guide.jpg"),
          title: "Take Frontal Photo",
          overlay: "frontal",
        })}
      {step === "side" &&
        renderGuide({
          guideSrc: require("../../assets/capture-guides/side-guide.jpg"),
          title: "Take Side Photo",
          overlay: "side",
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
