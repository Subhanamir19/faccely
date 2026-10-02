import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";

import { StoryTextScreen } from "@/components/onboarding";
import { ORANGE_ONBOARDING } from "@/components/onboarding/OrangeOnboardingLayout";
import T from "@/components/ui/T";
import { requestPotentialFaceGeneration } from "@/lib/api/potentialFace";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  getPushPermission,
  requestPushPermission,
  type PushPermission,
} from "@/lib/pushNotifications";
import { ms } from "@/lib/responsive";
import { usePotentialFace } from "@/store/potentialFace";
import { useScores } from "@/store/scores";

/**
 * The hopeful beat after the problems: the potential face is on its way.
 * Also the moment to ask for notifications, because the user now has a
 * concrete reason to say yes.
 */
function PotentialFaceGeneratingCard() {
  const status = usePotentialFace((s) => s.data?.status ?? null);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void getPushPermission().then(setPermission);
  }, []);

  // Safety net: loading fires the generation request without awaiting it. If
  // that call never landed there is no row yet; ask again. The endpoint is
  // idempotent, and a failed row is left alone (its retry costs a paid call
  // and belongs to the user, from the Progress card).
  useEffect(() => {
    let alive = true;
    (async () => {
      const current = await usePotentialFace.getState().load();
      const scanId = useScores.getState().scanId;
      if (!alive || current || !scanId) return;
      try {
        await requestPotentialFaceGeneration(scanId);
        if (alive) await usePotentialFace.getState().load();
      } catch {
        // Non-fatal: the Progress card offers a retry.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onNotify = useCallback(async () => {
    if (asking) return;
    setAsking(true);
    hapticLight();
    const next = await requestPushPermission();
    setPermission(next);
    if (next === "granted") hapticSuccess();
    setAsking(false);
  }, [asking]);

  if (status === "failed") return null;

  const ready = status === "ready";
  const title = ready ? "Your potential face is ready" : "Your potential face is being generated";
  const body = ready
    ? "Find it in your Progress tab."
    : permission === "granted"
      ? "We'll notify you the moment it's ready."
      : "It will appear in your Progress tab in a few minutes.";
  const showNotify = !ready && permission === "undetermined";

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Sparkles size={ms(18)} color={ORANGE_ONBOARDING.orange} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <T style={styles.title}>{title}</T>
        <T style={styles.body}>{body}</T>
      </View>
      {showNotify ? (
        <Pressable
          onPress={onNotify}
          disabled={asking}
          accessibilityRole="button"
          accessibilityLabel="Notify me when my potential face is ready"
          style={({ pressed }) => [styles.notify, pressed && styles.notifyPressed]}
        >
          <T style={styles.notifyText}>Notify me</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PlanIntroScreen() {
  const goNext = useCallback(() => {
    hapticLight();
    router.push({ pathname: "/(onboarding)/routine-animation", params: { fromAnalysis: "1" } });
  }, []);

  return (
    <StoryTextScreen
      lines={["Let us build", "a plan for you", "to fix these."]}
      accentLineIndex={2}
      ctaLabel="NEXT"
      onNext={goNext}
      accessibilityLabel="Continue to routine builder"
      accessory={<PotentialFaceGeneratingCard />}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    padding: ms(14),
    borderRadius: ms(20),
    backgroundColor: ORANGE_ONBOARDING.surface,
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
  },
  icon: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ORANGE_ONBOARDING.orangeSoft,
  },
  copy: { flex: 1, gap: ms(2) },
  title: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    fontSize: ms(14.5),
    lineHeight: ms(18),
    color: ORANGE_ONBOARDING.text,
  },
  body: {
    fontFamily: ORANGE_ONBOARDING.fontRegular,
    fontSize: ms(12.5),
    lineHeight: ms(16),
    color: ORANGE_ONBOARDING.muted,
  },
  notify: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
    borderRadius: ms(999),
    backgroundColor: ORANGE_ONBOARDING.orange,
  },
  notifyPressed: { opacity: 0.8 },
  notifyText: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    fontSize: ms(12.5),
    color: "#FFFFFF",
  },
});
