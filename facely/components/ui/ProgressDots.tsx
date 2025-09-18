// components/ui/ProgressDots.tsx
import { View, StyleSheet } from "react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";

export default function ProgressDots({ index }: { index: 0|1|2 }) {
  return (
    <View style={styles.row}>
      {[0,1,2].map(i => (
        <View key={i} style={[styles.dot, i === index && styles.active]} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: SP[2], alignSelf: "center", marginBottom: SP[4] },
  dot: { width: 8, height: 8, borderRadius: RADII.sm, backgroundColor: "rgba(255,255,255,0.25)" },
  active: { backgroundColor: COLORS.accent },
});
