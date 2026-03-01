// components/scores/ShareScoreButton.tsx
// Renders the share card off-screen, captures it, and opens the native share sheet.

import React, { useRef, useState } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Text,
  StyleSheet,
} from "react-native";
import { Share2 } from "lucide-react-native";
import ShareCard, { type ShareMetric } from "@/components/scores/ShareCard";
import { captureAndShare } from "@/lib/shareCard";
import { COLORS, RADII, SP } from "@/lib/tokens";

interface ShareScoreButtonProps {
  metrics: ShareMetric[];
  totalScore: number;
  streak: number;
  disabled?: boolean;
}

export default function ShareScoreButton({
  metrics,
  totalScore,
  streak,
  disabled = false,
}: ShareScoreButtonProps) {
  const cardRef = useRef<View | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading || disabled) return;
    try {
      setLoading(true);
      await captureAndShare(cardRef);
    } catch (e) {
      // Sharing cancelled or unavailable — silent fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Off-screen card for capture — must be mounted in the tree */}
      <View style={styles.offScreen} pointerEvents="none">
        <ShareCard
          metrics={metrics}
          totalScore={totalScore}
          streak={streak}
          cardRef={cardRef}
        />
      </View>

      {/* Share button */}
      <Pressable
        onPress={handleShare}
        disabled={loading || disabled}
        style={({ pressed }) => [
          styles.button,
          (loading || disabled) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Share your score"
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : (
          <>
            <Share2 size={15} color={COLORS.accent} />
            <Text style={styles.buttonText}>Share</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  offScreen: {
    position: "absolute",
    left: -9999,
    top: 0,
    opacity: 0,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    paddingHorizontal: SP[4],
    paddingVertical: SP[2] + 2,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: "rgba(180,243,77,0.08)",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  buttonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
});
