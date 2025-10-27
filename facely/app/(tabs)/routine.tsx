import React from "react";
import { SafeAreaView, View, ImageBackground, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import T from "@/components/ui/T";
import GlassCard from "@/components/ui/GlassCard";
import GlassBtn from "@/components/ui/GlassBtn";

const BG = require("../../assets/bg/score-bg.jpg");

export default function RoutineScreen() {
  const router = useRouter();

  function handleGoToAnalysis() {
    router.push("/(tabs)/analysis");
  }

  return (
    <ImageBackground source={BG} style={styles.flex} resizeMode="cover">
      <SafeAreaView style={styles.flex}>
        <View style={styles.scrim} />
        <View style={styles.content}>
          <T style={styles.title}>Routine</T>
          <GlassCard style={styles.card}>
            <View style={styles.cardInner}>
              <T style={styles.message}>Routine planning has been retired.</T>
              <T style={styles.subMessage}>
                You can still review your analysis and recommendations anytime.
              </T>
              <View style={styles.buttonWrap}>
                <GlassBtn
                  label="Go to Analysis"
                  icon="chevron-forward"
                  variant="primary"
                  onPress={handleGoToAnalysis}
                />
              </View>
            </View>
          </GlassCard>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.54)",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  card: {
    borderRadius: 28,
    backgroundColor: "rgba(10,11,12,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardInner: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 16,
    alignItems: "center",
  },
  message: {
    fontSize: 20,
    color: "#FFFFFF",
    textAlign: "center",
  },
  subMessage: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
  buttonWrap: {
    alignSelf: "stretch",
  },
});
