import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import GlassCard from "@/components/ui/GlassCard";
import GlassBtn from "@/components/ui/GlassBtn";
import T from "@/components/ui/T";
import CinematicLoader from "@/components/ui/CinematicLoader";
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

function ProtocolCard({ title, line }: { title: string; line: string }) {
  return (
    <GlassCard style={styles.card}>
      <T style={styles.cardTitle}>{title}</T>
      <T style={styles.cardBody}>{line}</T>
    </GlassCard>
  );
}

export default function ProtocolsScreen() {
  const { protocols, updatedAt, isLoading, error } = useProtocolsStore();

  const friendlyUpdatedAt = useMemo(() => {
    if (!updatedAt) return null;
    const d = new Date(updatedAt);
    const stamp = Number.isNaN(d.getTime()) ? null : d.toLocaleString();
    return stamp;
  }, [updatedAt]);

  const showLoading = isLoading;
  const showEmpty = !protocols && !isLoading && !error;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <T style={styles.title}>Protocols</T>
        {friendlyUpdatedAt ? <T style={styles.updatedAt}>Last updated: {friendlyUpdatedAt}</T> : null}

        {showLoading ? (
          <View style={styles.loaderWrap}>
            <View style={styles.loaderCard}>
              <CinematicLoader />
            </View>
            <T style={styles.loaderText}>Generating protocols</T>
          </View>
        ) : null}

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

        {!isLoading && protocols ? (
          <View style={styles.section}>
            {BUCKETS.map(({ key, label }) => (
              <ProtocolCard key={key} title={label} line={protocols[key]} />
            ))}
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorWrap}>
            <T style={styles.error}>{error}</T>
          </View>
        ) : null}

        <View style={styles.footer}>
          <GlassBtn label="Back" variant="primary" onPress={() => router.push("/(tabs)/take-picture")} />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: SP[3],
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: SP[2],
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[4],
    gap: SP[2],
  },
  loaderCard: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADII.card,
    overflow: "hidden",
  },
  loaderText: {
    color: COLORS.sub,
    fontSize: 14,
  },
  section: {
    marginTop: SP[3],
  },
  card: {
    marginBottom: SP[4],
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    borderRadius: RADII.card,
  },
  cardTitle: {
    color: COLORS.accent,
    fontSize: 16,
    marginBottom: SP[2],
  },
  updatedAt: {
    color: COLORS.sub,
    fontSize: 12,
    marginBottom: SP[2],
  },
  cardBody: {
    color: COLORS.sub,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-Regular",
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
  footer: {
    marginTop: 24,
    gap: SP[2],
    paddingBottom: 32,
  },
  error: {
    color: "#FF6B6B",
    fontSize: 13,
    textAlign: "center",
  },
  errorWrap: {
    gap: SP[2],
    marginTop: SP[4],
  },
});
