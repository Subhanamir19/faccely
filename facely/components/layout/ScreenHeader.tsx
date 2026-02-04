// components/layout/ScreenHeader.tsx
// Unified screen header with optional back button, title, subtitle, and right action

import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";
import { COLORS, SP } from "@/lib/tokens";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
};

export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  backLabel,
  onBack,
  rightAction,
}: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {showBack && (
        <BackButton label={backLabel} onPress={onBack} />
      )}

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text variant="h2" color="text">{title}</Text>
          {subtitle && (
            <Text variant="caption" color="sub" style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>

        {rightAction && (
          <View style={styles.rightAction}>{rightAction}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    gap: SP[1],
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleBlock: {
    flex: 1,
    gap: SP[1],
  },
  subtitle: {
    marginTop: SP[0],
  },
  rightAction: {
    marginLeft: SP[3],
  },
});
