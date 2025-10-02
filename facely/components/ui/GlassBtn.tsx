import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Text from "@/components/ui/T";
import { Ionicons } from "@expo/vector-icons";

export default function GlassBtn({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1 }}>
      {({ pressed }) => (
        <View style={styles.shadow}>
          <BlurView
            intensity={60}
            tint="dark"
            style={[
              styles.btn,
              disabled && { opacity: 0.4 },
              pressed && { transform: [{ translateY: 1 }] },
            ]}
          >
            <View style={styles.inner}>
              {icon ? (
                <Ionicons
                  name={icon as any}
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
              ) : null}
              <Text style={styles.text}>{label}</Text>
            </View>
            <View style={styles.rim} pointerEvents="none" />
          </BlurView>
        </View>
      )}
    </Pressable>
  );
}

const R = 28;

const styles = StyleSheet.create({
  shadow: {
    borderRadius: R,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    marginHorizontal: 6,
  },
  btn: {
    borderRadius: R,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)", // translucent, not flat
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 15, fontWeight: "700", color: "white" },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});
