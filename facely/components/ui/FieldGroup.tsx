// components/ui/FieldGroup.tsx
import { View, Text, TextInput, StyleSheet } from "react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
export function FieldInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={COLORS.sub} style={styles.input} {...props} />;
}
const styles = StyleSheet.create({
  label: { color: COLORS.sub, fontSize: 14, marginBottom: SP[2] },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: RADII.lg,
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    color: COLORS.text,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
});
