// components/program/OfflineBanner.tsx
// Slim amber banner shown when the device has no internet connection.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { WifiOff } from "lucide-react-native";
import { SP } from "@/lib/tokens";

const AMBER = "#FFAA32";
const AMBER_BG = "rgba(255,170,50,0.10)";
const AMBER_BORDER = "rgba(255,170,50,0.25)";

export default function OfflineBanner() {
  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      exiting={FadeOutUp.duration(200)}
      style={styles.banner}
    >
      <WifiOff size={13} color={AMBER} />
      <Text style={styles.text}>You're offline · Progress saves locally</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: AMBER_BG,
    borderBottomWidth: 1,
    borderBottomColor: AMBER_BORDER,
    paddingHorizontal: SP[4],
  },
  text: {
    color: AMBER,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 16,
  },
});
