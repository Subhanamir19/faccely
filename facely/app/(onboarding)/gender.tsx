import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { router } from "expo-router";
import { useOnboarding } from "@/store/onboarding";

const ACCENT = "#23A455";
const ACCENT_DARK = "#177A3E";
const BG = "#F5F7FA";
const TEXT_DARK = "#0F172A";
const TEXT_SUB = "#667085";
const CARD = "#FFFFFF";
const BORDER = "rgba(15,23,42,0.08)";

type Row = { key: string; label: string; icon: string };
const OPTIONS: Row[] = [
  { key: "Male",   label: "Male",   icon: "♂︎" },
  { key: "Female", label: "Female", icon: "♀︎" },
  { key: "Other",  label: "Other / Prefer not to say", icon: "👤" },
];

export default function GenderScreen() {
  const { data, setField, finish } = useOnboarding();
  const selected = data.gender;

  const choose = (label: string) => setField("gender", label);
  const end = async () => { await finish(); router.replace("/take-picture"); };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* progress pill 3/3 */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "100%" }]} />
          </View>
        </View>

        <Text style={styles.title}>What’s your gender?</Text>
        <Text style={styles.sub}>
          We adjust benchmarks and analysis according to biological differences.
        </Text>

        <FlatList
          style={{ marginTop: 18 }}
          data={OPTIONS}
          keyExtractor={(it) => it.key}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const active = selected === item.label;
            return (
              <View style={styles.optShadow}>
                <Pressable
                  android_ripple={{ color: "transparent" }}  // no gray wash
                  onPress={() => choose(item.label)}
                  style={({ pressed }) => [
                    styles.optBase,
                    active && styles.optActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.icon, active && styles.iconActive]}>{item.icon}</Text>
                  <Text style={[styles.optText, active && styles.optTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          scrollEnabled={false}
        />

        <Pressable
          onPress={end}
          disabled={!selected}
          accessibilityState={{ disabled: !selected }}
          android_ripple={{ color: "transparent" }}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, !selected && { opacity: 0.6 }]}
        >
          <Text style={styles.primaryLabel}>Finish</Text>
        </Pressable>

        <Pressable
          onPress={end}
          android_ripple={{ color: "transparent" }}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
        >
          <Text style={styles.ghostLabel}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const R = 22;

const styles = StyleSheet.create({
  pressed: { transform: [{ translateY: 1 }] },

  screen: { flex: 1, backgroundColor: BG, padding: 20, justifyContent: "center" },

  card: {
    backgroundColor: CARD,
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },

  progressWrap: { alignItems: "center", marginBottom: 14 },
  progressTrack: {
    height: 16, width: "85%", borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    borderWidth: 1, borderColor: "rgba(15,23,42,0.05)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "rgba(35,164,85,0.35)" },

  title: { fontSize: 26, lineHeight: 30, fontWeight: "800", color: TEXT_DARK, marginTop: 6 },
  sub: { fontSize: 14, lineHeight: 20, color: TEXT_SUB, marginTop: 8 },

  // Shadow wrapper so we can keep Pressable itself clean
  optShadow: {
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,                 // subtle, natural
  },
  optBase: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT_DARK,
  },
  icon: { fontSize: 18, color: "#8A94A6", width: 22, textAlign: "center" },
  iconActive: { color: "#FFFFFF" },
  optText: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },
  optTextActive: { color: "#FFFFFF" },

  primaryBtn: {
    marginTop: 22,
    backgroundColor: ACCENT,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  ghostBtn: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ghostLabel: { color: TEXT_DARK, fontSize: 16, fontWeight: "700" },
});
