import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ArrowUpRight } from "lucide-react-native";
import T from "@/components/ui/T";
import { FACE_MAP as theme } from "./face-map-theme";
import { FaceMapArt } from "./face-map-art";

export function FaceMapEntry({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Explore your face map, example preview" style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.portrait} accessible={false}><FaceMapArt width={72} height={76} /></View>
      <View style={styles.copy}>
        <T style={styles.eyebrow}>NEW · FACE MAP</T>
        <T style={styles.title}>Explore your face map</T>
        <T style={styles.subtitle}>A little color. A clearer focus.</T>
      </View>
      <ArrowUpRight size={20} strokeWidth={2} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 24, backgroundColor: "#EDF4DF" },
  pressed: { opacity: 0.72 },
  portrait: { width: 64, height: 76, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 5 },
  eyebrow: { fontFamily: theme.bold, color: "#527135", fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: theme.bold, color: theme.ink, fontSize: 18, lineHeight: 22 },
  subtitle: { fontFamily: theme.font, color: theme.muted, fontSize: 13, lineHeight: 18 },
});

