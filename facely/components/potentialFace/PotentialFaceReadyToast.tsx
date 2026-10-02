// components/potentialFace/PotentialFaceReadyToast.tsx
// Announces a freshly generated potential face. The face generates in the
// background after purchase and is never shown inside the onboarding flow;
// this toast (plus a dot on the Progress tab) is how the user finds out.
//
// "Unseen" = the active row is ready and its id is not the one the reveal
// screen last acknowledged. Tapping opens the full-screen reveal once; the
// Progress tab card is the everyday view after that.

import React, { useCallback, useEffect } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Sparkles, X } from "lucide-react-native";

import T from "@/components/ui/T";
import { ORANGE_ONBOARDING } from "@/components/onboarding/OrangeOnboardingLayout";
import { usePotentialFace } from "@/store/potentialFace";
import { usePendingPushReveal } from "@/lib/pushNotifications";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";

export function useHasUnseenPotentialFace(): boolean {
  return usePotentialFace(
    (s) => s.data?.status === "ready" && s.data.id !== s.revealSeenPotentialFaceId,
  );
}

function openReveal() {
  router.push("/potential-face");
}

export default function PotentialFaceReadyToast() {
  const insets = useSafeAreaInsets();
  const unseen = useHasUnseenPotentialFace();
  const status = usePotentialFace((s) => s.data?.status ?? null);
  const markRevealSeen = usePotentialFace((s) => s.markRevealSeen);
  const pendingPushReveal = usePendingPushReveal((s) => s.pending);

  // Check on mount and when the app returns to the foreground, only while the
  // face is unknown or generating; poll so the toast appears without a relaunch.
  const refresh = useCallback(async () => {
    const store = usePotentialFace.getState();
    // Read-only status check, and only while the answer can still change:
    // nothing known yet, or a generation in progress. A settled face (ready,
    // failed, unlocked) is never re-requested on launch; the Progress tab
    // loads its own card when visited.
    if (store.data && store.data.status !== "pending") return;
    const fresh = await store.load();
    if (fresh?.status === "pending") void store.pollUntilReady();
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // A notification tap that cold-started the app lands here once the tabs
  // are mounted. Wait for the row to load before opening the reveal.
  useEffect(() => {
    if (!pendingPushReveal || status === null || status === "pending") return;
    usePendingPushReveal.getState().setPending(false);
    openReveal();
  }, [pendingPushReveal, status]);

  const onOpen = useCallback(() => {
    hapticSuccess();
    openReveal();
  }, []);

  const onDismiss = useCallback(() => {
    hapticLight();
    // The card in Progress still shows the face; this only retires the toast.
    markRevealSeen();
  }, [markRevealSeen]);

  if (!unseen) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(320)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + sh(6) }]}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Your potential face is ready. Open it."
        style={({ pressed }) => [styles.toast, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Sparkles size={ms(18)} color={ORANGE_ONBOARDING.orange} strokeWidth={2} />
        </View>
        <View style={styles.copy}>
          <T style={styles.title}>Your potential face is ready</T>
          <T style={styles.sub}>Tap to see it. It also lives in Progress.</T>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.close}
        >
          <X size={ms(16)} color={ORANGE_ONBOARDING.muted} strokeWidth={2} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: sw(14),
    right: sw(14),
    zIndex: 50,
    elevation: 12,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    paddingVertical: ms(12),
    paddingLeft: ms(12),
    paddingRight: ms(10),
    borderRadius: ms(20),
    backgroundColor: ORANGE_ONBOARDING.surface,
    shadowColor: "#050505",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  pressed: { transform: [{ scale: 0.98 }] },
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
    fontSize: ms(15),
    lineHeight: ms(19),
    color: ORANGE_ONBOARDING.text,
  },
  sub: {
    fontFamily: ORANGE_ONBOARDING.fontRegular,
    fontSize: ms(12.5),
    lineHeight: ms(16),
    color: ORANGE_ONBOARDING.muted,
  },
  close: { padding: ms(4) },
});
