// components/ui/GumButton.tsx
import { Pressable, Text, View, StyleSheet } from "react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";

const DEPTH = 4;

type Props = { label: string; onPress?: () => void; disabled?: boolean; variant?: "primary"|"ghost" };
export default function GumButton({ label, onPress, disabled, variant="primary" }: Props) {
  const isGhost = variant === "ghost";
  const baseColor = isGhost ? "#111111" : "rgba(30,100,10,0.5)";

  if (disabled) {
    return (
      <View style={[styles.base, isGhost ? styles.ghost : styles.primary, { opacity: 0.5 }]}>
        <View style={styles.inner}>
          <Text style={[styles.label, isGhost && { color: COLORS.text }]}>{label}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: RADII.xl, backgroundColor: baseColor, paddingBottom: DEPTH }]}>
      <Pressable onPress={onPress} style={({ pressed }) => [
        styles.base,
        isGhost ? styles.ghost : styles.primary,
        { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
      ]}>
        <View style={styles.inner}>
          <Text style={[styles.label, isGhost && { color: COLORS.text }]}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.xl,
    paddingVertical: SP[4],
    paddingHorizontal: SP[6],
  },
  inner: {
    justifyContent: "center",
    alignItems: "center",
  },
  primary: {
    backgroundColor: "rgba(93,214,44,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  label: {
    color: "#DDF8D5",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
