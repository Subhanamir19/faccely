import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { router } from "expo-router";
import { useOnboarding } from "@/store/onboarding";

const ACCENT = "#23A455";
const ACCENT_DARK = "#177A3E";
const BG = "#F5F7FA";
const TEXT_DARK = "#0F172A";
const TEXT_SUB = "#667085";
const CARD = "#FFFFFF";
const BORDER = "rgba(15,23,42,0.06)";

const OPTIONS = [
  "Asian",
  "African",
  "Caucasian",
  "Hispanic / Latino",
  "Middle Eastern",
  "Mixed / Other",
];

export default function EthnicityScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.ethnicity;

  const rows = useMemo(() => OPTIONS.map(label => ({ key: label, label })), []);

  const onNext = () => {
    if (!selected) return;
    router.push("/(onboarding)/gender");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* progress pill (step 2/3) */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(2 / 3) * 100}%` }]} />
          </View>
        </View>

        <Text style={styles.title}>What’s your ethnicity?</Text>
        <Text style={styles.sub}>
          This helps us calibrate analysis based on global population data.
        </Text>

        <FlatList
          style={{ marginTop: 18 }}
          data={rows}
          keyExtractor={(it) => it.key}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const active = selected === item.label;
            return (
              <Pressable
                onPress={() => setField("ethnicity", item.label)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && { transform: [{ translateY: 1 }] },
                ]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
          scrollEnabled={false}
        />

        <Pressable
          onPress={onNext}
          // keep same color whether selected or not; just block taps when not selected
          disabled={!selected}
          accessibilityState={{ disabled: !selected }}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { transform: [{ translateY: 1 }] },
          ]}
        >
          <Text style={styles.primaryLabel}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

const R = 22;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  progressWrap: { alignItems: "center", marginBottom: 14 },
  progressTrack: {
    height: 16,
    width: "85%",
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(35,164,85,0.35)",
  },

  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
    marginTop: 6,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SUB,
    textAlign: "center",
    marginTop: 8,
  },

  option: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  optionActive: {
    backgroundColor: ACCENT,            // solid green
    borderColor: ACCENT_DARK,
    shadowOpacity: 0.12,
  },
  optionText: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  optionTextActive: {
    color: "#FFFFFF",                   // white text when active
  },

  primaryBtn: {
    marginTop: 20,
    backgroundColor: ACCENT,            // always green
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
