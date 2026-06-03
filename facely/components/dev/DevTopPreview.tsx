import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Component, LayoutDashboard, Sparkles } from "lucide-react-native";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";

type Props = {
  onPreviewScoreDeck: () => void;
  onPreviewProgressStory: () => void;
  onPreviewExerciseIntro: () => void;
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  accent?: boolean;
};

function ActionButton({ label, onPress, accent = false }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        accent && styles.actionButtonAccent,
        pressed && styles.actionButtonPressed,
      ]}
    >
      <T style={[styles.actionText, accent && styles.actionTextAccent]}>{label}</T>
    </Pressable>
  );
}

export default function DevTopPreview({
  onPreviewScoreDeck,
  onPreviewProgressStory,
  onPreviewExerciseIntro,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconTile}>
          <Component color={COLORS.accent} size={24} strokeWidth={2.6} />
        </View>
        <View style={styles.headerCopy}>
          <T style={styles.kicker}>DEV COMPONENTS</T>
          <T style={styles.title}>Preview hub</T>
          <T style={styles.subtitle}>
            Fast access to the main component previews without scrolling through the full tool list.
          </T>
        </View>
      </View>

      <View style={styles.previewGrid}>
        <View style={[styles.previewTile, styles.previewTileAccent]}>
          <Sparkles color={COLORS.accent} size={19} strokeWidth={2.5} />
          <T style={styles.previewTileTitle}>Score deck</T>
          <T style={styles.previewTileSub}>Swipe card UI</T>
        </View>
        <View style={styles.previewTile}>
          <LayoutDashboard color={COLORS.dim} size={19} strokeWidth={2.5} />
          <T style={styles.previewTileTitle}>Stories</T>
          <T style={styles.previewTileSub}>Progress concepts</T>
        </View>
      </View>

      <View style={styles.actions}>
        <ActionButton label="Score Deck" accent onPress={onPreviewScoreDeck} />
        <ActionButton label="Progress Story" onPress={onPreviewProgressStory} />
        <ActionButton label="Exercise Intro" onPress={onPreviewExerciseIntro} />
      </View>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.22,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.xl,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[4],
    gap: SP[4],
    ...CARD_SHADOW,
  },
  headerRow: {
    flexDirection: "row",
    gap: SP[3],
    alignItems: "flex-start",
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    color: COLORS.accent,
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    color: COLORS.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.sub,
    marginTop: 4,
  },
  previewGrid: {
    flexDirection: "row",
    gap: SP[3],
  },
  previewTile: {
    flex: 1,
    minHeight: 92,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    padding: SP[3],
    justifyContent: "space-between",
  },
  previewTileAccent: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.accentBorder,
  },
  previewTileTitle: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: SP[2],
  },
  previewTileSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: COLORS.sub,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[2],
  },
  actionButton: {
    minHeight: 44,
    flexGrow: 1,
    flexBasis: "30%",
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
  },
  actionButtonAccent: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.accentBorder,
  },
  actionButtonPressed: {
    opacity: 0.78,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.dim,
    textAlign: "center",
  },
  actionTextAccent: {
    color: COLORS.accent,
  },
});
