import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";
import { useRecoveryCodeStore } from "@/store/recoveryCode";

export default function RecoveryCodeHint() {
  const recoveryCode = useRecoveryCodeStore((s) => s.code);
  const hasSeenCodeHint = useRecoveryCodeStore((s) => s.hasSeenCodeHint);
  const markHintSeen = useRecoveryCodeStore((s) => s.markHintSeen);

  const visible = Boolean(recoveryCode && !hasSeenCodeHint);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay: 800, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, delay: 800, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        markHintSeen();
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.banner, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.icon}>🔑</Text>
      <Text style={styles.text}>
        Your recovery code is in{" "}
        <Text style={styles.accent}>Profile</Text>
        {" "}— keep it safe.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 58,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    flex: 1,
    lineHeight: 18,
  },
  accent: {
    color: "#B4F34D",
  },
});
