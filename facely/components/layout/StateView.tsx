// components/layout/StateView.tsx
// Unified loading, error, and empty state display component

import React from "react";
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";

type StateViewProps = {
  loading?: boolean;
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
};

export default function StateView({
  loading = false,
  loadingText = "Loading...",
  error = null,
  onRetry,
  empty = false,
  emptyIcon = "📊",
  emptyTitle = "No data",
  emptySubtitle = "Nothing to display here yet",
}: StateViewProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text variant="captionMedium" color="sub" style={styles.text}>
          {loadingText}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text variant="captionMedium" style={styles.errorText}>
          {error}
        </Text>
        {onRetry && (
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            onPress={onRetry}
          >
            <Text variant="captionSemiBold" color="bgBottom">
              Retry
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <Animated.View entering={FadeIn.delay(200)} style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{emptyIcon}</Text>
        </View>
        <Text variant="h4" color="text" style={styles.text}>
          {emptyTitle}
        </Text>
        <Text variant="caption" color="sub" style={styles.subtitle}>
          {emptySubtitle}
        </Text>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[8],
    gap: SP[3],
  },
  text: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    color: COLORS.error,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  icon: {
    fontSize: 36,
  },
});
