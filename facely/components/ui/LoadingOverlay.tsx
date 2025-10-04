// C:\SS\facely\components\ui\LoadingOverlay.tsx
import React from "react";
import { Modal, View, ActivityIndicator, Text, Platform } from "react-native";
import { useLoading } from "@/store/loading";

export default function LoadingOverlay() {
  const visible = useLoading((s) => s.count > 0);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: 140,
            paddingVertical: 20,
            paddingHorizontal: 16,
            borderRadius: 18,
            backgroundColor: "#0E0F10",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
          }}
        >
          <ActivityIndicator size="large" />
          <Text
            style={{
              marginTop: 10,
              color: "rgba(255,255,255,0.85)",
              fontSize: 14,
              fontFamily: Platform.OS === "android" ? "Poppins-SemiBold" : undefined,
            }}
          >
            Processing…
          </Text>
        </View>
      </View>
    </Modal>
  );
}
