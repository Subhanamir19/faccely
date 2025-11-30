import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import T from "@/components/ui/T";
import GlassBtn from "@/components/ui/GlassBtn";
import GlassCard from "@/components/ui/GlassCard";
import { COLORS } from "@/lib/tokens";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";
import { useProfile } from "@/store/profile";
import { useScores } from "@/store/scores";
import { useProtocolsStore } from "@/store/protocolsStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSigmaStore } from "@/store/sigma";
import { useRecommendations } from "@/store/recommendations";
import { persistAvatarFromUri } from "@/lib/media/avatar";

async function resetLocalUserData() {
  try {
    useAuthStore.getState().clearAuthState();
  } catch {}
  try {
    useOnboarding.getState().reset?.();
  } catch {}
  try {
    useProfile.getState().clearAvatar();
  } catch {}
  try {
    useScores.getState().reset();
  } catch {}
  try {
    useProtocolsStore.getState().clear();
  } catch {}
  try {
    useRoutineStore.getState().resetRoutine();
  } catch {}
  try {
    useSigmaStore.getState().resetThread();
  } catch {}
  try {
    useRecommendations.getState().reset();
  } catch {}
}

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const authUser = useAuthStore((state) => state.user);
  const onboardingData = useOnboarding((state) => state.data);
  const hydrateOnboarding = useOnboarding((state) => state.hydrate);
  const avatarUri = useProfile((state) => state.avatarUri);
  const hydrateProfile = useProfile((state) => state.hydrate);
  const setProfileAvatar = useProfile((state) => state.setAvatar);
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsHydrating(true);
      try {
        await Promise.allSettled([hydrateOnboarding(), hydrateProfile()]);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hydrateOnboarding, hydrateProfile]);

  const name =
    (authUser as any)?.fullName ||
    (authUser as any)?.firstName ||
    (authUser as any)?.name ||
    "Unknown user";
  const email =
    (authUser as any)?.email ??
    (authUser as any)?.emailAddress ??
    (authUser as any)?.emailAddresses?.[0]?.emailAddress ??
    "Email unavailable";

  const avatarSource = avatarUri
    ? { uri: avatarUri }
    : require("../../assets/icon.png");

  const gender = onboardingData.gender || "Not set";
  const ethnicity = onboardingData.ethnicity || "Not set";
  const age =
    typeof onboardingData.age === "number"
      ? String(onboardingData.age)
      : "Not set";

  const handleChangePhoto = async () => {
    if (changingPhoto || deletingAccount) return;
    try {
      setChangingPhoto(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      const persisted = await persistAvatarFromUri(uri);
      await setProfileAvatar(persisted);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update avatar.";
      Alert.alert("Photo error", message);
    } finally {
      setChangingPhoto(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut || deletingAccount) return;
    setLoggingOut(true);
    try {
      await signOut();
      useAuthStore.getState().clearAuthState();
      router.replace("/(auth)/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign out failed. Please try again.";
      Alert.alert("Log out", message);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount || loggingOut) return;
    Alert.alert(
      "Delete account?",
      "This will remove your data from this device. You can sign in again later, but your history and settings in this app will be gone. Active subscriptions are handled separately and are not cancelled here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void performDelete(),
        },
      ]
    );
  };

  const performDelete = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await resetLocalUserData();
      try {
        await signOut();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Signed out locally after deletion.";
        Alert.alert("Sign out", message);
      }
      router.replace("/(auth)/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete account locally. Please try again.";
      Alert.alert("Delete account failed", message);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isHydrating ? (
          <T style={styles.hydratingLabel}>Loading profile…</T>
        ) : null}

        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Image source={avatarSource} style={styles.avatarImage} resizeMode="cover" />
            </View>
          </View>
          <View style={styles.avatarButton}>
            <GlassBtn
              label={changingPhoto ? "Changing..." : "Change photo"}
              onPress={handleChangePhoto}
              disabled={changingPhoto || deletingAccount || isHydrating}
            />
          </View>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <T style={styles.cardLabel}>Linked account</T>
            <T style={styles.cardSubtext}>Connected via Google</T>
          </View>
          <View style={styles.accountRow}>
            <View>
              <T style={styles.primaryText}>{name}</T>
              <T style={styles.subText}>{email}</T>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <T style={styles.cardLabel}>Demographics</T>
            <T style={styles.cardSubtext}>Basic profile details</T>
          </View>
          <View style={styles.row}>
            <T style={styles.rowLabel}>Gender</T>
            <T style={styles.rowValue}>{gender}</T>
          </View>
          <View style={styles.row}>
            <T style={styles.rowLabel}>Ethnicity</T>
            <T style={styles.rowValue}>{ethnicity}</T>
          </View>
          <View style={styles.row}>
            <T style={styles.rowLabel}>Age</T>
            <T style={styles.rowValue}>{age}</T>
          </View>
        </GlassCard>

        <View style={styles.dangerZone}>
          <GlassCard style={styles.dangerCard}>
            <T style={styles.dangerLabel}>Danger zone</T>
            <View style={styles.dangerButtons}>
              <View style={styles.dangerBtn}>
                <GlassBtn
                  label="Delete account"
                  variant="glass"
                  onPress={handleDeleteAccount}
                  disabled={deletingAccount || loggingOut || isHydrating}
                />
              </View>
              <View style={styles.dangerBtn}>
                <GlassBtn
                  label={loggingOut ? "Logging out..." : "Log out"}
                  variant="primary"
                  onPress={handleLogout}
                  disabled={loggingOut || deletingAccount || isHydrating}
                />
              </View>
            </View>
          </GlassCard>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 18,
  },
  hydratingLabel: {
    color: COLORS.sub,
    marginBottom: 4,
    fontSize: 13,
    textAlign: "center",
  },
  avatarSection: {
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  avatarInner: {
    width: 118,
    height: 118,
    borderRadius: 59,
    overflow: "hidden",
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarButton: {
    width: 180,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeader: {
    marginBottom: 10,
  },
  cardLabel: {
    color: COLORS.text,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  cardSubtext: {
    marginTop: 4,
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
  },
  accountRow: {
    paddingVertical: 6,
  },
  primaryText: {
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  subText: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
  },
  rowLabel: {
    color: COLORS.sub,
    fontSize: 14,
  },
  rowValue: {
    color: COLORS.text,
    fontSize: 15,
  },
  dangerZone: {
    marginTop: 10,
  },
  dangerCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,0,0,0.02)",
    borderColor: "rgba(255,0,0,0.15)",
  },
  dangerLabel: {
    color: COLORS.sub,
    fontSize: 14,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  dangerButtons: {
    flexDirection: "column",
    gap: 12,
  },
  dangerBtn: {
    width: "100%",
  },
});
