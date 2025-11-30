import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import GlassCard from "@/components/ui/GlassCard";
import GlassBtn from "@/components/ui/GlassBtn";
import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import type { ProtocolBucketKey } from "@/lib/api/protocols";
import { useProtocolsStore } from "@/store/protocolsStore";

const BUCKETS: { key: ProtocolBucketKey; label: string }[] = [
  { key: "glass_skin", label: "Glass Skin" },
  { key: "debloating", label: "Debloating" },
  { key: "facial_symmetry", label: "Facial Symmetry" },
  { key: "maxilla", label: "Maxilla" },
  { key: "hunter_eyes", label: "Hunter Eyes" },
  { key: "cheekbones", label: "Cheekbones" },
  { key: "nose", label: "Nose" },
  { key: "jawline", label: "Jawline" },
];

export default function ProtocolsScreen() {
  const { protocols, updatedAt, isLoading, error, regenerateFromLastAnalysis } = useProtocolsStore();

  const friendlyUpdatedAt = useMemo(() => {
    if (!updatedAt) return null;
    const d = new Date(updatedAt);
    const stamp = Number.isNaN(d.getTime()) ? null : d.toLocaleString();
    return stamp;
  }, [updatedAt]);

  const showEmpty = !protocols && !isLoading;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {showEmpty ? (
          <View style={styles.emptyWrap}>
            <T style={styles.emptyTitle}>Run your first analysis to unlock personalized protocols.</T>
            <GlassBtn
              label="Start analysis"
              variant="primary"
              onPress={() => router.push("/(tabs)/take-picture")}
            />
          </View>
        ) : null}

        {protocols ? (
          <View style={styles.section}>
            {friendlyUpdatedAt ? (
              <T style={styles.updatedAt}>Last updated: {friendlyUpdatedAt}</T>
            ) : null}
            {BUCKETS.map(({ key, label }) => (
              <GlassCard key={key} style={styles.card}>
                <T style={styles.cardTitle}>{label}</T>
                <T style={styles.cardBody}>{protocols[key]}</T>
              </GlassCard>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <GlassBtn
            label={isLoading ? "Generating" : "Regenerate protocols"}
            variant="primary"
            onPress={regenerateFromLastAnalysis}
            disabled={isLoading}
          />
          {error ? <T style={styles.error}>{error}</T> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },
  scroll: {
    paddingHorizontal: SP[5],
    paddingVertical: SP[5],
    gap: SP[4],
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[5],
    gap: SP[3],
  },
  emptyTitle: {
    color: COLORS.sub,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    gap: SP[3],
  },
  updatedAt: {
    color: COLORS.sub,
    fontSize: 12,
    marginBottom: 2,
  },
  card: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    borderRadius: RADII.xl,
  },
  cardTitle: {
    color: COLORS.accent,
    fontSize: 16,
    marginBottom: SP[2],
  },
  cardBody: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-Regular",
  },
  footer: {
    marginTop: SP[4],
    gap: SP[2],
    paddingBottom: SP[4],
  },
  error: {
    color: "#FF6B6B",
    fontSize: 13,
  },
});
