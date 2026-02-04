// components/ui/ImageCard.tsx
// Reusable image card with label and consistent styling

import React from "react";
import { View, Image, StyleSheet } from "react-native";
import Text from "./T";
import { COLORS, SP, RADII } from "@/lib/tokens";

type ImageCardProps = {
  label: string;
  uri?: string | null;
  width?: number;
  aspectRatio?: number;
};

export default function ImageCard({
  label,
  uri,
  width,
  aspectRatio = 3 / 4,
}: ImageCardProps) {
  return (
    <View style={[styles.container, width ? { width } : styles.flex]}>
      <Text variant="captionMedium" color="text">
        {label}
      </Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { aspectRatio }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { aspectRatio }]}>
          <Text variant="caption" color="sub">
            No image
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADII.xl,
    padding: SP[3],
    gap: SP[2],
  },
  flex: {
    flex: 1,
  },
  image: {
    width: "100%",
    borderRadius: RADII.lg,
    backgroundColor: COLORS.track,
  },
  placeholder: {
    width: "100%",
    borderRadius: RADII.lg,
    backgroundColor: COLORS.track,
    alignItems: "center",
    justifyContent: "center",
  },
});
