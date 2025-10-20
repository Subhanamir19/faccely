import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";

import CinematicLoader from "@/components/ui/CinematicLoader";

import { useOnboarding } from "@/store/onboarding";
import { useScores } from "../store/scores";
import { ensureJpegCompressed } from "../lib/api/media";

type ParamValue = string | string[] | undefined;

type Params = {
  mode?: "analyzePair" | "advanced" | string;
  front?: ParamValue;
  side?: ParamValue;
  phase?: ParamValue;
  frontName?: ParamValue;
  sideName?: ParamValue;
  frontMime?: ParamValue;
  sideMime?: ParamValue;
  normalized?: ParamValue;
};

function takeFirst(value?: ParamValue): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
      return raw;
    }
  }
  return toFileUri(raw);
}

export default function LoadingScreen() {
  const { completed } = useOnboarding();
  const params = useLocalSearchParams<Params>();
  const analyzePair = useScores((state) => state.analyzePair);
  const explainPair = useScores((state) => state.explainPair);
  const explain = useScores((state) => state.explain);

  const mode = takeFirst(params.mode);
  const front = takeFirst(params.front);
  const side = takeFirst(params.side);
  const phase = takeFirst(params.phase);
  const frontName = takeFirst(params.frontName);
  const sideName = takeFirst(params.sideName);
  const frontMime = takeFirst(params.frontMime);
  const sideMime = takeFirst(params.sideMime);
  const normalized = takeFirst(params.normalized);



  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const handleError = (err: unknown, title: string) => {
      if (cancelled) return;
      setIsLoading(false);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Unknown error";
      if (message) {
        Alert.alert(title, message);
      }
      const canGoBack =
        typeof router.canGoBack === "function" ? router.canGoBack() : false;
      if (canGoBack) {
        router.back();
      } else {
        router.replace("/error");
      }
    };

    if (mode === "analyzePair") {
      (async () => {
        try {
          if (!front || !side) {
            throw new Error("Both frontal and side images are required.");
          }

          const decodedFront = safeDecode(front);
          const decodedSide = safeDecode(side);

          const frontUriRaw = await ensureFileUriAsync(decodedFront);
          const sideUriRaw = await ensureFileUriAsync(decodedSide);

          if (!frontUriRaw || !sideUriRaw) {
            throw new Error("Image paths could not be resolved.");
          }

          const alreadyNormalized = normalized === "1";
          let frontMeta: { uri: string; name?: string; mime?: string };
          let sideMeta: { uri: string; name?: string; mime?: string };

          if (
            alreadyNormalized &&
            frontName &&
            sideName &&
            frontMime &&
            sideMime
          ) {
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
            const [frontNorm, sideNorm] = await Promise.all([
              ensureJpegCompressed(frontUriRaw),
              ensureJpegCompressed(sideUriRaw),
            ]);
            frontMeta = {
              uri: frontNorm.uri,
              name: frontNorm.name,
              mime: "image/jpeg",
            };
            sideMeta = {
              uri: sideNorm.uri,
              name: sideNorm.name,
              mime: "image/jpeg",
            };
          }

          const scores = await analyzePair(frontMeta as any, sideMeta as any);
          if (cancelled) return;

          const wantsAnalysis = phase === "analysis";
          if (wantsAnalysis) {
            const ok = await explainPair(
              frontMeta.uri,
              sideMeta.uri,
              scores,
            );
            if (!ok) {
              throw new Error("Advanced analysis did not return results.");
            }
            if (cancelled) return;
            setIsLoading(false);
            router.replace("/(tabs)/analysis");
            return;
          }

          setIsLoading(false);
          router.replace({
            pathname: "/(tabs)/score",
            params: { scoresPayload: JSON.stringify(scores) },
          });
        } catch (error) {
          handleError(error, "Analysis failed");
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (mode === "advanced") {
      (async () => {
        try {
          const { imageUri: storedImageUri, scores: storedScores } =
            useScores.getState();
          if (!storedImageUri || !storedScores) {
            throw new Error("Scores not found. Please run analysis again.");
          }
          const ok = await explain(storedImageUri, storedScores);
          if (!ok) {
            throw new Error("Advanced analysis did not return results.");
          }
          if (cancelled) return;
          setIsLoading(false);
          router.replace("/(tabs)/analysis");
        } catch (error) {
          handleError(error, "Advanced analysis failed");
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (!completed) {
      setIsLoading(false);
      router.replace("/(onboarding)/welcome");
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(false);
    router.replace("/(tabs)/take-picture");

    return () => {
      cancelled = true;
    };
  }, [
    analyzePair,
    explain,
    explainPair,
    completed,
    mode,
    phase,
    front,
    side,
    normalized,
    frontName,
    sideName,
    frontMime,
    sideMime,
  ]);

  return (
    <CinematicLoader loading={isLoading} />

  );
}
