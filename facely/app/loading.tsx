// C:\SS\facely\app\loading.tsx
import React, { useEffect, useRef, useState } from "react";
import { Animated, Alert, Easing } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import CinematicLoader from "@/components/ui/CinematicLoader.tsx";
import { LOADING_STAGE_COPY, resolveLoadingStage } from "@/lib/loadingStages.ts";
import { useOnboarding } from "@/store/onboarding";
import { useScores } from "../store/scores";
import * as FileSystem from "expo-file-system";

// NEW: ensure pre-upload JPEG normalization (max 1080px, ~80% quality)
import { ensureJpegCompressed } from "../lib/api/media";

function readAnimatedValue(animatedValue: Animated.Value): number {
  const candidate = animatedValue as any;
  if (typeof candidate.__getValue === "function") {
    return candidate.__getValue();
  }
  const raw = candidate?._value;
  return typeof raw === "number" ? raw : 0;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function initialBadgeValue(badge: number | "random"): string {
  if (badge === "random") {
    return "0%";
  }
  return `${badge}%`;
}


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



type Params = {
  mode?: "analyzePair" | "advanced" | string;
  front?: string;
  side?: string;
  phase?: string;


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
    phase,
    sideMime,
    normalized,
  } = useLocalSearchParams<Params>();
  const scoresStore = useScores();

  // progress 0..100
  const prog = useRef(new Animated.Value(0)).current;
  const loopStopRef = useRef(false);



  const stage = resolveLoadingStage({ mode, phase });
  const stageCopy = LOADING_STAGE_COPY[stage];
  const [badgeText, setBadgeText] = useState(() => initialBadgeValue(stageCopy.badge));


  const startIndeterminateLoop = () => {
    loopStopRef.current = false;
    prog.stopAnimation();
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
    prog.stopAnimation();

  };

  useEffect(() => {
    if (stageCopy.badge === "random") {

      const updateRandom = () => {
        setBadgeText(`${Math.floor(Math.random() * 101)}%`);
      };

      updateRandom();
      const interval = setInterval(updateRandom, 900);
      return () => clearInterval(interval);
    }

    if (typeof stageCopy.badge === "number") {
      setBadgeText(`${stageCopy.badge}%`);
      return;
    }

    setBadgeText(formatPercent(readAnimatedValue(prog)));
    const listenerId = prog.addListener(({ value }) => {
      setBadgeText(formatPercent(value));

    });

    return () => {
      prog.removeListener(listenerId);
    };
  }, [stageCopy.badge, prog]);



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
  

  return (
    <CinematicLoader
      progress={prog}
      title={stageCopy.title}
      subtitle={stageCopy.subtitle}
      badgeText={badgeText}
    />
  );
}


