// C:\SS\facely\app\loading.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import T from "@/components/ui/T";
import { useOnboarding } from "@/store/onboarding";
import { useScores } from "../store/scores";
import * as FileSystem from "expo-file-system";

// NEW: ensure pre-upload JPEG normalization (max 1080px, ~80% quality)
import { ensureJpegCompressed } from "../lib/api/media";


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
      return raw; // fallback
    }
  }
  return toFileUri(raw);
}

// ===== Tokens =====
const LIME = "#8FA31E";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_DIM = "rgba(255,255,255,0.65)";
const CARD_BORDER = "rgba(255,255,255,0.12)";
const CARD_TINT = "rgba(15,15,15,0.72)";
const PURPLE = "#B77CFF"; // progress ring
const PURPLE_END = "#8A63FF"; // ring head
const TRACK = "rgba(255,255,255,0.08)";

const SIZE = 240;
const RING = 210;
const STROKE = 12;

type Params = {
  mode?: "analyzePair" | "advanced" | string;
  front?: string;
  side?: string;

  // optional metadata if caller already normalized
  frontName?: string;
  sideName?: string;
  frontMime?: string;
  sideMime?: string;
  normalized?: string; // "1" if already normalized
};

export default function LoadingScreen() {
  const { completed } = useOnboarding();
  const {
    mode,
    front,
    side,
    frontName,
    sideName,
    frontMime,
    sideMime,
    normalized,
  } = useLocalSearchParams<Params>();
  const scoresStore = useScores();

  // progress 0..100
  const prog = useRef(new Animated.Value(0)).current;
  const loopStopRef = useRef(false);

  const startIndeterminateLoop = () => {
    loopStopRef.current = false;
    const tick = () => {
      if (loopStopRef.current) return;
      prog.setValue(0);
      Animated.timing(prog, {
        toValue: 100,
        duration: 1600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && !loopStopRef.current) tick();
      });
    };
    tick();
  };

  const stopLoop = () => {
    loopStopRef.current = true;
  };

  useEffect(() => {
    // Task modes take precedence over onboarding bootstrap
    if (mode === "analyzePair") {
      if (!front || !side) {
        Alert.alert("Missing images", "Both frontal and side images are required.");
        router.back();
        return;
      }

      startIndeterminateLoop();

      (async () => {
        try {
          // 1) decode what we encoded during navigation
          const decodedFront = decodeURIComponent(front as string);
          const decodedSide = decodeURIComponent(side as string);

          // 2) normalize for Android content:// and ensure file://
          const frontUriRaw = await ensureFileUriAsync(decodedFront);
          const sideUriRaw = await ensureFileUriAsync(decodedSide);

          if (!frontUriRaw || !sideUriRaw) {
            throw new Error("Image paths could not be resolved.");
          }

          // 3) If previous screen already normalized & passed meta, use it.
          //    Otherwise, enforce JPEG compression here as a safety net.
          let frontMeta: { uri: string; name?: string; mime?: string };
          let sideMeta: { uri: string; name?: string; mime?: string };

          const alreadyNormalized = normalized === "1";

          if (alreadyNormalized && frontName && sideName) {
            frontMeta = {
              uri: frontUriRaw,
              name: frontName || "front.jpg",
              mime: frontMime || "image/jpeg",
            };
            sideMeta = {
              uri: sideUriRaw,
              name: sideName || "side.jpg",
              mime: sideMime || "image/jpeg",
            };
          } else {
            // Safety: ensure size and codec are sane before upload
            const [frontNorm, sideNorm] = await Promise.all([
              ensureJpegCompressed(frontUriRaw),
              ensureJpegCompressed(sideUriRaw),
            ]);
            frontMeta = { uri: frontNorm.uri, name: frontNorm.name, mime: "image/jpeg" };
            sideMeta = { uri: sideNorm.uri, name: sideNorm.name, mime: "image/jpeg" };
          }

          console.log("[loading] analyzePair metas:", {
            front: frontMeta.name,
            side: sideMeta.name,
          });

          const out = await scoresStore.analyzePair(frontMeta as any, sideMeta as any);

          stopLoop();
          router.replace({
            pathname: "/(tabs)/score",
            params: { scoresPayload: JSON.stringify(out) },
          });
        } catch (e: any) {
          stopLoop();
          const msg = String(e?.message || e || "Unknown error");
          Alert.alert("Analysis failed", msg);
          router.back();
        }
      })();

      return;
    }

    if (mode === "advanced") {
      // imageUri + scores are already in the store after scoring step
      startIndeterminateLoop();

      (async () => {
        try {
          const { imageUri: storedImageUri, scores: storedScores } = scoresStore;
          if (!storedImageUri || !storedScores) {
            throw new Error("Scores not found. Please run analysis again.");
          }

          const ok = await scoresStore.explain(storedImageUri, storedScores);
          stopLoop();
          if (ok) {
            router.replace("/(tabs)/analysis");
          } else {
            throw new Error("Advanced analysis did not return results.");
          }
        } catch (e: any) {
          stopLoop();
          Alert.alert("Advanced analysis failed", String(e?.message || e));
          router.back();
        }
      })();

      return;
    }

    // Default: original onboarding bootstrap behavior (unchanged path)
    if (!completed) {
      router.replace("/(onboarding)/welcome");

      return;
    }

    Animated.timing(prog, {
      toValue: 100,
      duration: 2200,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) router.replace("/(tabs)/take-picture");
    });
  }, [completed, mode, front, side, frontName, sideName, frontMime, sideMime, normalized]);

  // Derived values for ring + percent
  const pctText = prog.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 100],
  });

  return (
    <LinearGradient colors={["#0B0911", "#0B0911"]} style={styles.screen}>
      {/* purple radial glow */}
      <LinearGradient
        colors={["rgba(151, 91, 255,0.35)", "rgba(0,0,0,0)"]}
        style={styles.radialGlow}
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.centerWrap}>
        <BlurView intensity={50} tint="dark" style={styles.card}>
          <View style={styles.cardOverlay} />

          {/* Ring + Avatar */}
          <View style={styles.ringWrap}>
            <Animated.View
              style={[
                styles.svgWrap,
                { transform: [{ rotate: "-90deg" }] }, // start at top
              ]}
            >
              <View
                style={[
                  styles.circleBase,
                  {
                    borderColor: TRACK,
                    width: RING,
                    height: RING,
                    borderWidth: STROKE,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.circleProg,
                  {
                    width: RING,
                    height: RING,
                    borderWidth: STROKE,
                    borderColor: PURPLE,
                  },
                ]}
              />
            </Animated.View>

            {/* Sweep head (indeterminate look) */}
            <Animated.View
              style={[
                styles.sweep,
                {
                  width: RING,
                  height: RING,
                  borderRadius: RING / 2,
                  transform: [
                    {
                      rotate: prog.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[PURPLE, PURPLE_END]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.sweepHead}
              />
            </Animated.View>

            {/* Inner avatar */}
            <View style={styles.avatarWrap}>
              <Image
                source={require("../assets/loading/face-loader.jpg")}
                style={styles.avatar}
                resizeMode="cover"
              />
            </View>

            {/* Mask ring placeholder */}
            <Animated.View
              style={[
                styles.mask,
                {
                  borderWidth: STROKE,
                  width: RING,
                  height: RING,
                  borderRadius: RING / 2,
                },
              ]}
            />
          </View>

          {/* Headline */}
          <T style={styles.headline}>
            {mode === "advanced"
              ? "Running advanced analysis"
              : mode === "analyzePair"
              ? "Scoring your photos"
              : "Max your Looks"}
          </T>

          {/* Subline */}
          <T style={styles.subline}>
            {mode ? "Please hold, this can take a few seconds" : "Preparing analysis algorithm"}
          </T>

          {/* Percent pill */}
          <View style={styles.pill}>
            <T style={styles.pillText}>{Math.round((prog as any)._value ?? 0)}%</T>
          </View>
        </BlurView>
      </View>

      {/* Grassy bottom image like your other screens */}
      <ImageBackground
        source={require("../assets/bg/score-bg.jpg")}
        style={styles.bottomBg}
        imageStyle={{ resizeMode: "cover" }}
      />
    </LinearGradient>
  );
}


const R = 28;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  radialGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },

  bottomBg: {
    position: "absolute",
    bottom: -10,
    left: 0,
    right: 0,
    height: 200,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  card: {
    width: "92%",
    borderRadius: R,
    overflow: "hidden",
    paddingTop: 26,
    paddingBottom: 28,
    alignItems: "center",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,15,0.72)",
    borderRadius: R,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  ringWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  svgWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  circleBase: { position: "absolute", borderRadius: RING / 2, opacity: 0.5 },
  circleProg: { position: "absolute", borderRadius: RING / 2, opacity: 0.2 },
  sweep: { position: "absolute", alignItems: "center", justifyContent: "center" },
  sweepHead: {
    position: "absolute",
    right: -STROKE / 2,
    width: STROKE + 8,
    height: STROKE + 8,
    borderRadius: (STROKE + 8) / 2,
  },

  avatarWrap: {
    width: SIZE - 54,
    height: SIZE - 54,
    borderRadius: (SIZE - 54) / 2,
    overflow: "hidden",
    borderWidth: 6,
    borderColor: "rgba(0,0,0,0.65)",
    backgroundColor: "#111",
  },
  avatar: { width: "100%", height: "100%" },

  mask: { position: "absolute", borderColor: "transparent" },

  headline: {
    marginTop: 22,
    fontSize: 28,
    lineHeight: 32,
    color: LIME,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  subline: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_DIM,
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
  },

  pill: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillText: {
    fontSize: 14,
    color: TEXT,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
});
