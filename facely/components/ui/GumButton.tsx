// components/ui/GumButton.tsx
import { Pressable, Text, View, StyleSheet } from "react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";

type Props = { label: string; onPress?: () => void; disabled?: boolean; variant?: "primary"|"ghost" };
export default function GumButton({ label, onPress, disabled, variant="primary" }: Props) {
  const isGhost = variant === "ghost";
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      styles.base,
      isGhost ? styles.ghost : styles.primary,
      pressed && styles.pressed,
      disabled && { opacity: 0.5 }
    ]}>
      <View style={styles.inner}>
        <Text style={[styles.label, isGhost && { color: COLORS.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.xl,
    paddingVertical: SP[4],
    paddingHorizontal: SP[6],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inner: {
    justifyContent: "center",
    alignItems: "center",
  },
  primary: {
    backgroundColor: "rgba(93,214,44,0.18)",
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pressed: {
    transform: [{ translateY: 1.5 }],
    shadowOpacity: 0.25,
  },
  label: {
    color: "#DDF8D5",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
