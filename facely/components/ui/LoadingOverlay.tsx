// components/ui/LoadingOverlay.tsx
// Lightweight modal spinner for short-lived background work. Light surface
// on a dimmed backdrop so it stays consistent with the app's light system.
import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLoading } from "@/store/loading";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sw } from "@/lib/responsive";

const LIME = "#B4F34D";

export default function LoadingOverlay() {
  const visible = useLoading((s) => s.count > 0);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={LIME} />
          <Text style={styles.label}>Processing…</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(SP[6]),
  },
  card: {
    width: sw(150),
    paddingVertical: ms(20),
    paddingHorizontal: ms(16),
    borderRadius: ms(20),
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightHairline,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: ms(22),
    shadowOffset: { width: 0, height: ms(8) },
    elevation: 6,
  },
  label: {
    marginTop: ms(10),
    color: COLORS.lightText,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },
});
