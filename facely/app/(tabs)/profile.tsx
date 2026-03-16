import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  Image,
  Alert,
  Pressable,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import T from "@/components/ui/T";
import GlassBtn from "@/components/ui/GlassBtn";
import GlassCard from "@/components/ui/GlassCard";
import { COLORS } from "@/lib/tokens";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";
import { useProfile } from "@/store/profile";
import { useScores } from "@/store/scores";
import { useProtocolsStore } from "@/store/protocolsStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSigmaStore } from "@/store/sigma";
import { useRecommendations } from "@/store/recommendations";
import { useSubscriptionStore } from "@/store/subscription";
import { persistAvatarFromUri } from "@/lib/media/avatar";
import { restorePurchases, checkSubscriptionStatus, logoutUser as logoutRevenueCatUser } from "@/lib/revenuecat";
import { logger } from '@/lib/logger';
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { useRecoveryCodeStore } from "@/store/recoveryCode";

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
  // Reset subscription state (clears both RevenueCat entitlement and promo activation)
  try {
    useSubscriptionStore.getState().reset();
  } catch {}
}

export default function ProfileScreen() {
  const authUser = useAuthStore((state) => state.user);
  const onboardingData = useOnboarding((state) => state.data);
  const hydrateOnboarding = useOnboarding((state) => state.hydrate);
  const avatarUri = useProfile((state) => state.avatarUri);
  const displayName = useProfile((state) => state.displayName);
  const hydrateProfile = useProfile((state) => state.hydrate);
  const setProfileAvatar = useProfile((state) => state.setAvatar);
  const setDisplayName = useProfile((state) => state.setDisplayName);
  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((state) => state.promoActivated);
  const setRevenueCatEntitlement = useSubscriptionStore((state) => state.setRevenueCatEntitlement);
  const hasAccess = revenueCatEntitlement || promoActivated;
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const recoveryCode = useRecoveryCodeStore((s) => s.code);
  const generating = useRecoveryCodeStore((s) => s.generating);
  const ensureCode = useRecoveryCodeStore((s) => s.ensureCode);

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

  // Sync name input once store hydrates
  useEffect(() => {
    if (!isHydrating) setNameInput(displayName ?? "");
  }, [isHydrating, displayName]);

  // Ensure recovery code exists for subscribed users (including those who purchased before this feature)
  useEffect(() => {
    if (hasAccess) {
      ensureCode().catch(() => {});
    }
  }, [hasAccess, ensureCode]);

  const name =
    (authUser as any)?.fullName ||
    (authUser as any)?.firstName ||
    (authUser as any)?.name ||
    "User";
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
      // Logout from RevenueCat first (clears user association)
      try {
        await logoutRevenueCatUser();
      } catch (rcErr) {
        logger.warn("[Profile] RevenueCat logout failed:", rcErr);
      }
      await resetLocalUserData();
      await supabase.auth.signOut();
      // AuthProvider will re-enter anonymous automatically.
      router.replace("/");
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
      // Logout from RevenueCat first (clears user association)
      try {
        await logoutRevenueCatUser();
      } catch (rcErr) {
        logger.warn("[Profile] RevenueCat logout failed:", rcErr);
      }
      await resetLocalUserData();
      try {
        await supabase.auth.signOut();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Signed out locally after deletion.";
        Alert.alert("Sign out", message);
      }
      // AuthProvider will re-enter anonymous automatically.
      router.replace("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete account locally. Please try again.";
      Alert.alert("Delete account failed", message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (restoringPurchases || isHydrating) return;
    setRestoringPurchases(true);
    try {
      await restorePurchases();
      // Only updates RevenueCat state, never touches promo
      const hasEntitlement = await checkSubscriptionStatus();
      setRevenueCatEntitlement(hasEntitlement);

      if (hasEntitlement) {
        Alert.alert(
          "Purchases Restored!",
          "Your subscription has been restored successfully."
        );
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases associated with your account."
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restore purchases. Please try again.";
      Alert.alert("Restore Failed", message);
    } finally {
      setRestoringPurchases(false);
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
            <T style={styles.cardLabel}>Demographics</T>
            <T style={styles.cardSubtext}>Basic profile details</T>
          </View>
          <View style={styles.row}>
            <T style={styles.rowLabel}>Name</T>
            <View style={styles.nameInputRow}>
              <TextInput
                ref={nameInputRef}
                style={styles.nameInput}
                value={nameInput}
                onChangeText={(v) => { setNameInput(v); setNameSaved(false); }}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                returnKeyType="done"
                onSubmitEditing={async () => {
                  await setDisplayName(nameInput);
                  setNameSaved(true);
                  setTimeout(() => setNameSaved(false), 2000);
                }}
                maxLength={30}
              />
              <Pressable
                style={styles.nameSaveBtn}
                onPress={async () => {
                  await setDisplayName(nameInput);
                  setNameSaved(true);
                  nameInputRef.current?.blur();
                  setTimeout(() => setNameSaved(false), 2000);
                }}
              >
                <T style={styles.nameSaveBtnText}>{nameSaved ? "Saved!" : "Save"}</T>
              </Pressable>
            </View>
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

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <T style={styles.cardLabel}>Subscription</T>
            <T style={styles.cardSubtext}>
              {hasAccess
                ? promoActivated
                  ? "Active (Promo Code)"
                  : "Active - Sigma Max Pro"
                : "No active subscription"}
            </T>
          </View>
          <View style={styles.subscriptionActions}>
            <View style={styles.subscriptionBtn}>
              <GlassBtn
                label={restoringPurchases ? "Restoring..." : "Restore Purchases"}
                variant="glass"
                onPress={handleRestorePurchases}
                disabled={restoringPurchases || isHydrating}
              />
            </View>
          </View>
        </GlassCard>


        <GlassCard style={styles.card}>
          <T
            style={styles.privacyLink}
            onPress={() => WebBrowser.openBrowserAsync("https://third-tamarillo-756.notion.site/Privacy-Policy-30266c2b427680a29ba5e586b5913999")}
          >
            Privacy Policy ↗
          </T>
        </GlassCard>

        {hasAccess ? (
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <T style={styles.cardLabel}>Recovery Code</T>
              <T style={styles.cardSubtext}>
                Save this — use it to restore your subscription if you ever reinstall the app.
              </T>
            </View>
            {recoveryCode ? (
              <View style={styles.recoveryRow}>
                <T style={styles.recoveryCode}>{recoveryCode}</T>
                <Pressable
                  style={styles.copyBtn}
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(recoveryCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    } catch {}
                  }}
                >
                  <T style={styles.copyBtnText}>{codeCopied ? "Copied!" : "Copy"}</T>
                </Pressable>
              </View>
            ) : (
              <T style={styles.generatingLabel}>
                {generating ? "Generating your code…" : "Loading…"}
              </T>
            )}
          </GlassCard>
        ) : null}

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
  nameInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end",
  },
  nameInput: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Poppins-Regular",
    textAlign: "right",
    flex: 1,
    paddingVertical: 0,
  },
  nameSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  nameSaveBtnText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
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
  subscriptionActions: {
    flexDirection: "column",
    gap: 12,
    marginTop: 8,
  },
  subscriptionBtn: {
    width: "100%",
  },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 12,
  },
  recoveryCode: {
    color: COLORS.accent,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 2,
    flex: 1,
  },
  copyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  copyBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },
  generatingLabel: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginTop: 4,
  },
  privacyLink: {
    color: COLORS.sub,
    fontSize: 14,
    textDecorationLine: "underline",
    textAlign: "center",
    paddingVertical: 4,
  },
});
