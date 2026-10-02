import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";

import CinematicLoader from "@/components/ui/CinematicLoader";

import { useOnboarding } from "@/store/onboarding";
import { useScores } from "../store/scores";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { usePotentialFace } from "@/store/potentialFace";
import { ensureJpegCompressed } from "../lib/api/media";
import { useAuthStore } from "@/store/auth";
import { requestPotentialFaceGeneration } from "@/lib/api/potentialFace";
import { prefetchFaceGeometry } from "@/lib/faceLandmarks";

type ParamValue = string | string[] | undefined;

type Params = {
  mode?: "analyzePair" | "advanced" | "onboardingPotentialFace" | string;
  front?: ParamValue;
  side?: ParamValue;
  phase?: ParamValue;
  frontName?: ParamValue;
  sideName?: ParamValue;
  frontMime?: ParamValue;
  sideMime?: ParamValue;
  normalized?: ParamValue;
  onboardingFlow?: ParamValue;
};

type ImageMeta = { uri: string; name: string; mime: string };

// How long the completed ring stays on screen before the results open. Long
// enough to read as "done", short enough not to feel like a delay.
const COMPLETE_HOLD_MS = 450;


function takeFirst(value?: ParamValue): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeMode(
  value?: string
): "analyzePair" | "advanced" | "onboardingPotentialFace" | undefined {
  if (value === "analyzePair" || value === "advanced" || value === "onboardingPotentialFace") return value;
  return undefined;
}

function normalizePhase(value?: string): "scoring" | "analysis" {
  return value === "analysis" ? "analysis" : "scoring";
}

function normalizeNormalized(value?: string): "0" | "1" {
  return value === "1" ? "1" : "0";
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

async function ensurePersistentImageDir(): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error("Persistent storage unavailable. Please restart the app.");
  }
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

async function ensureLocalPairExists(frontUri: string, sideUri: string) {
  const [i1, i2] = await Promise.all([
    FileSystem.getInfoAsync(frontUri),
    FileSystem.getInfoAsync(sideUri),
  ]);
  if (!i1.exists || !i2.exists) {
    throw new Error("Missing local image files. Please reselect.");
  }
}

export default function LoadingScreen() {
  const { completed, hydrate } = useOnboarding();
  const params = useLocalSearchParams<Params>();
  const analyzePair = useScores((state) => state.analyzePair);
  const explainPair = useScores((state) => state.explainPair);

  const mode = normalizeMode(takeFirst(params.mode));
  const front = takeFirst(params.front);
  const side = takeFirst(params.side);
  const phase = normalizePhase(takeFirst(params.phase));
  const frontName = takeFirst(params.frontName);
  const sideName = takeFirst(params.sideName);
  const frontMime = takeFirst(params.frontMime);
  const sideMime = takeFirst(params.sideMime);
  const normalized = normalizeNormalized(takeFirst(params.normalized));
  const onboardingFlow = takeFirst(params.onboardingFlow) === "1";

  const storedImageUri = useScores((state) => state.imageUri);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await hydrate();
        const done = useOnboarding.getState().completed;
        useAuthStore.getState().setOnboardingCompletedFromOnboarding(done);
      } finally {
        if (!cancelled) setOnboardingHydrated(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;

    if (!onboardingHydrated) return () => {
      cancelled = true;
    };

    // Fill the ring, then open the results once the user has seen it finish.
    const completeThen = (go: () => void) => {
      setIsLoading(false);
      setTimeout(() => {
        if (!cancelled) go();
      }, COMPLETE_HOLD_MS);
    };

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
        router.replace("/(tabs)/take-picture");
      }
    };

    const runAnalyzePairWorkflow = async () => {
      try {
        if (!front || !side) {
          throw new Error("Both frontal and side images are required.");
        }

        const decodedFront = safeDecode(front);
        const decodedSide = safeDecode(side);
        let frontMeta: ImageMeta;
        let sideMeta: ImageMeta;

        if (normalized === "1") {
          frontMeta = {
            uri: decodedFront,
            name: frontName ?? "front.jpg",
            mime: frontMime ?? "image/jpeg",
          };
          sideMeta = {
            uri: decodedSide,
            name: sideName ?? "side.jpg",
            mime: sideMime ?? "image/jpeg",
          };
        } else {
          const [frontResolved, sideResolved] = await Promise.all([
            ensureFileUriAsync(decodedFront),
            ensureFileUriAsync(decodedSide),
          ]);

          if (!frontResolved || !sideResolved) {
            throw new Error("Image paths could not be resolved.");
          }
          if (cancelled) return;

          const [frontTemp, sideTemp] = await Promise.all([
            ensureJpegCompressed(frontResolved),
            ensureJpegCompressed(sideResolved),
          ]);
          if (cancelled) return;

          const [frontPersisted, sidePersisted] = await Promise.all([
            persistCompressedResult(frontTemp),
            persistCompressedResult(sideTemp),
          ]);

          frontMeta = {
            uri: frontPersisted.uri,
            name: frontPersisted.name,
            mime: "image/jpeg",
          };
          sideMeta = {
            uri: sidePersisted.uri,
            name: sidePersisted.name,
            mime: "image/jpeg",
          };
        }

        await ensureLocalPairExists(frontMeta.uri, sideMeta.uri);
        if (cancelled) return;

        const scores = await analyzePair(frontMeta, sideMeta);
        if (cancelled) return;

        if (phase === "analysis") {
          const ok = await explainPair(
            frontMeta.uri,
            sideMeta.uri,
            scores,
          );
          if (!ok) {
            throw new Error("Advanced analysis did not return results.");
          }
          if (cancelled) return;
          completeThen(() => router.replace("/analysis"));
          return;
        }

        // Fire explainPair in background so dashboard has full sub-metric
        // data ready by the time user navigates there. User doesn't wait.
        explainPair(frontMeta.uri, sideMeta.uri, scores).catch(() => {});

        completeThen(() =>
          router.replace({
            pathname: "/score",
            params: { scoresPayload: JSON.stringify(scores) } as any,
          })
        );
        
      } catch (error) {
        handleError(error, "Analysis failed");
      }
    };

    const runAdvancedWorkflow = async () => {
      try {
        const { imageUri: storedImageUri, scores: storedScores } =
          useScores.getState();
        if (!storedImageUri || !storedScores) {
          throw new Error("Scores not found. Please run analysis again.");
        }
        const { data, error: advError } = await useAdvancedAnalysis
          .getState()
          .ensureFetched();
        if (cancelled) return;
        if (!data) {
          throw new Error(advError ?? "Advanced analysis did not return results.");
        }
        completeThen(() =>
          router.replace(
            onboardingFlow
              ? { pathname: "/analysis", params: { onboardingFlow: "1" } }
              : "/analysis"
          )
        );
      } catch (error) {
        handleError(error, "Advanced analysis failed");
      }
    };

    const runOnboardingPotentialFaceWorkflow = async () => {
      try {
        const onboarding = useOnboarding.getState();
        const frontUri = onboarding.scanFrontalUri;
        const sideUri = onboarding.scanSideUri;
        if (!frontUri || !sideUri) {
          throw new Error("Onboarding scan photos were not found.");
        }

        const [frontResolved, sideResolved] = await Promise.all([
          ensureFileUriAsync(frontUri),
          ensureFileUriAsync(sideUri),
        ]);
        if (!frontResolved || !sideResolved) {
          throw new Error("Image paths could not be resolved.");
        }
        if (cancelled) return;

        const frontMeta = {
          uri: frontResolved,
          name: "front.jpg",
          mime: "image/jpeg",
        };
        const sideMeta = {
          uri: sideResolved,
          name: "side.jpg",
          mime: "image/jpeg",
        };

        await ensureLocalPairExists(frontMeta.uri, sideMeta.uri);
        if (cancelled) return;

        const scores = await useScores.getState().ensurePairAnalyzed(frontMeta, sideMeta);
        if (cancelled) return;

        const scoreState = useScores.getState();
        // Face detection for the reveal runs alongside the advanced analysis.
        prefetchFaceGeometry(scoreState.imageUri);
        const scanId = scoreState.scanId;
        if (!scanId) {
          throw new Error("Scan was scored but not saved. Please try again later.");
        }
        const { data: advancedData, error: advancedError } = await useAdvancedAnalysis
          .getState()
          .ensureFetched();
        if (cancelled) return;

        if (!advancedData) {
          throw new Error(advancedError ?? "Advanced analysis did not return results.");
        }

        // The potential face generates in the background and is revealed
        // later from the Progress tab; it never blocks this flow. plan-intro
        // requests it again (idempotent) in case this call fails.
        void requestPotentialFaceGeneration(scanId)
          .then(() => usePotentialFace.getState().load())
          .catch((generationError) => {
            console.warn("[loading] potential face generation request failed:", generationError);
          });

        useOnboarding.getState().clearScanPhotos();
        completeThen(() =>
          router.replace({ pathname: "/analysis-reveal", params: { onboardingFlow: "1" } })
        );
      } catch (error) {
        console.warn("[loading] onboarding post-purchase workflow failed:", error);
        if (cancelled) return;
        // Terminal either way: clear the photos so a relaunch does not retry
        // the same failing pair in a loop.
        useOnboarding.getState().clearScanPhotos();
        setIsLoading(false);
        if (useScores.getState().scores) {
          // Scoring worked, only advanced analysis failed. The analysis
          // screen retries it and offers a way on to the plan.
          router.replace({ pathname: "/analysis", params: { onboardingFlow: "1" } });
        } else {
          Alert.alert(
            "We couldn't analyze your photos",
            "Your subscription is active. Take a new scan to get your full analysis.",
          );
          router.replace("/(tabs)/take-picture");
        }
      }
    };

    if (mode === "analyzePair") {
      runAnalyzePairWorkflow();
      return () => {
        cancelled = true;
      };
    }

    if (mode === "advanced") {
      runAdvancedWorkflow();
      return () => {
        cancelled = true;
      };
    }

    if (mode === "onboardingPotentialFace") {
      runOnboardingPotentialFaceWorkflow();
      return () => {
        cancelled = true;
      };
    }

    if (!completed) {
      setIsLoading(false);
      router.replace("/(onboarding)/hook");
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
    explainPair,
    completed,
    onboardingHydrated,
    mode,
    phase,
    front,
    side,
    normalized,
    onboardingFlow,
    frontName,
    sideName,
    frontMime,
    sideMime,
  ]);

  const photoUri = front
    ? safeDecode(front)
    : storedImageUri ?? undefined;
  const isPostPaywallLoading = mode === "onboardingPotentialFace" || onboardingFlow;
  return (
    <CinematicLoader
      loading={isLoading}
      photoUri={photoUri}
      appearance={isPostPaywallLoading ? "onboarding" : "default"}
    />
  );
}
