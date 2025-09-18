// components/ui/GlassCard.tsx
import { View, StyleSheet } from "react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";

export default function GlassCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADII.xl,
    padding: SP[5],
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: "hidden",
  },
});
