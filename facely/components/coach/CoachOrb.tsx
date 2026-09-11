import React, { useCallback, useEffect, useMemo } from "react";
import { Text, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, TYPE } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";
import { useCoach } from "@/store/coach";

/* ============================================================================
 * The floating Coach button.
 *
 * Draggable, snaps to whichever side it is nearest, and remembers where it was
 * left on each screen. Position is per-route on purpose: the spot that is out
 * of the way on the dashboard covers the primary button on the routine screen.
 *
 * Everything runs on the UI thread through Reanimated, so dragging stays smooth
 * while a reply is streaming and re-rendering the sheet behind it.
 * ========================================================================== */

const ORB_SIZE = 56;
const EDGE_MARGIN = 16;
/** Clearance for the tab bar, so the button never sits on top of it. */
const BOTTOM_MARGIN = 96;
const IDLE_OPACITY = 0.78;
const IDLE_DELAY_MS = 4000;

/**
 * Routes with no Coach button.
 *
 * Camera and scan loading are full-bleed and time-sensitive; onboarding and the
 * paywall are funnels where anything tappable that is not the primary action is
 * a leak.
 */
const HIDDEN_PREFIXES = [
  "/take-picture",
  "/loading",
  "/(onboarding)",
  "/(auth)",
  "/paywall",
  "/face-scan",
  "/index",
];

function isHidden(pathname: string): boolean {
  if (!pathname || pathname === "/") return true;
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Stable key for remembering a position; the route without its parameters. */
function routeKey(pathname: string): string {
  return pathname.split("?")[0] || "/";
}

export function CoachOrb() {
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const disabled = useCoach((state) => state.disabled);
  const sheetOpen = useCoach((state) => state.open);
  const unread = useCoach((state) => state.unread);
  const openCoach = useCoach((state) => state.openCoach);
  const setOrbPosition = useCoach((state) => state.setOrbPosition);
  const orbPositions = useCoach((state) => state.orbPositions);

  const key = routeKey(pathname);
  const hidden = isHidden(pathname) || disabled;

  const bounds = useMemo(() => {
    const minY = insets.top + EDGE_MARGIN;
    const maxY = height - insets.bottom - BOTTOM_MARGIN - ORB_SIZE;
    return {
      left: EDGE_MARGIN,
      right: width - ORB_SIZE - EDGE_MARGIN,
      minY,
      maxY: Math.max(minY, maxY),
    };
  }, [width, height, insets.top, insets.bottom]);

  const saved = orbPositions[key];
  const x = useSharedValue(saved?.x ?? bounds.right);
  const y = useSharedValue(saved?.y ?? bounds.maxY - 24);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // Moving between screens restores that screen's own position.
  useEffect(() => {
    const next = orbPositions[key];
    x.value = withSpring(next?.x ?? bounds.right, { damping: 18 });
    y.value = withSpring(
      Math.min(Math.max(next?.y ?? bounds.maxY - 24, bounds.minY), bounds.maxY),
      { damping: 18 }
    );
  }, [key, bounds.right, bounds.maxY, bounds.minY, orbPositions, x, y]);

  // Fade back once it has been sitting still, so it stops competing with the
  // screen's own content.
  useEffect(() => {
    opacity.value = 1;
    const timer = setTimeout(() => {
      opacity.value = withTiming(IDLE_OPACITY, { duration: 400 });
    }, IDLE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [key, sheetOpen, opacity]);

  const persist = useCallback(
    (nextX: number, nextY: number) => {
      setOrbPosition(key, { x: nextX, y: nextY });
    },
    [key, setOrbPosition]
  );

  const open = useCallback(() => {
    hapticLight();
    void openCoach(key);
  }, [key, openCoach]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .onStart(() => {
          opacity.value = withTiming(1, { duration: 120 });
          scale.value = withSpring(1.08);
        })
        .onChange((event) => {
          x.value += event.changeX;
          y.value += event.changeY;
        })
        .onEnd(() => {
          // Snap to the nearer side; a button floating mid-screen reads as a
          // mistake and is more likely to sit on top of something.
          const midpoint = x.value + ORB_SIZE / 2;
          const targetX = midpoint < width / 2 ? bounds.left : bounds.right;
          const targetY = Math.min(Math.max(y.value, bounds.minY), bounds.maxY);

          x.value = withSpring(targetX, { damping: 18 });
          y.value = withSpring(targetY, { damping: 18 });
          scale.value = withSpring(1);

          runOnJS(persist)(targetX, targetY);
          runOnJS(hapticLight)();
        }),
    [bounds.left, bounds.right, bounds.minY, bounds.maxY, width, x, y, opacity, scale, persist]
  );

  const tap = useMemo(
    () => Gesture.Tap().maxDuration(250).onEnd(() => runOnJS(open)()),
    [open]
  );

  // Pan wins over tap, so a drag never opens the sheet by accident.
  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (hidden || sheetOpen) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            width: ORB_SIZE,
            height: ORB_SIZE,
            borderRadius: ORB_SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.accent,
            shadowColor: COLORS.accentShadow,
            shadowOpacity: 0.9,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open Coach"
      >
        <Text style={{ ...TYPE.h4, color: "#0B0B0B" }}>◈</Text>

        {unread ? (
          <Animated.View
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: COLORS.error,
              borderWidth: 1.5,
              borderColor: COLORS.accent,
            }}
          />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
