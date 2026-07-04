import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import {
  Camera,
  Copy,
  KeyRound,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react-native";

import { AppGradientBackground } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { persistAvatarFromUri } from "@/lib/media/avatar";
import { logger } from "@/lib/logger";
import { checkSubscriptionStatus, logoutUser as logoutRevenueCatUser, restorePurchases } from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { useInsights } from "@/store/insights";
import { useOnboarding } from "@/store/onboarding";
import { useProfile } from "@/store/profile";
import { useProtocolsStore } from "@/store/protocolsStore";
import { useRecommendations } from "@/store/recommendations";
import { useRecoveryCodeStore } from "@/store/recoveryCode";
import { useRoutineStore } from "@/store/routineStore";
import { useScores } from "@/store/scores";
import { useSigmaStore } from "@/store/sigma";
import { useSubscriptionStore } from "@/store/subscription";

const FONT = "ProximaNova-Bold";
const DETAIL_FONT = "DINNextRounded-Regular";
const GREEN = "#67C900";

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

function LightCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function IconTile({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "danger" }) {
  return <View style={[styles.iconTile, tone === "green" && styles.iconTileGreen, tone === "danger" && styles.iconTileDanger]}>{children}</View>;
}

function ActionButton({
  label,
  onPress,
  disabled,
  variant = "primary",
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: React.ReactNode;
}) {
  const bg = disabled
    ? COLORS.lightSurfaceAlt
    : variant === "danger"
      ? COLORS.declineRedSoft
      : variant === "secondary"
        ? COLORS.lightSurfaceAlt
        : COLORS.ctaBlack;
  const fg = disabled
    ? COLORS.lightSub
    : variant === "danger"
      ? COLORS.declineRed
      : variant === "secondary"
        ? COLORS.lightText
        : "#FFFFFF";

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.actionButton, { backgroundColor: bg }, pressed && !disabled && styles.pressed]}
    >
      {icon ? <View style={styles.actionIcon}>{icon}</View> : null}
      <T style={[styles.actionButtonText, { color: fg }]}>{label}</T>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <T style={styles.infoLabel}>{label}</T>
      <T style={styles.infoValue}>{value}</T>
    </View>
  );
}

async function resetLocalUserData() {
  try { useAuthStore.getState().clearAuthState(); } catch {}
  try { useOnboarding.getState().reset?.(); } catch {}
  try { useProfile.getState().clearAvatar(); } catch {}
  try { useScores.getState().reset(); } catch {}
  try { useProtocolsStore.getState().clear(); } catch {}
  try { useRoutineStore.getState().resetRoutine(); } catch {}
  try { useSigmaStore.getState().resetThread(); } catch {}
  try { useRecommendations.getState().reset(); } catch {}
  try { useSubscriptionStore.getState().reset(); } catch {}
  try { useInsights.getState().invalidate?.(); } catch {}
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
  const recoveryCode = useRecoveryCodeStore((s) => s.code);
  const generating = useRecoveryCodeStore((s) => s.generating);
  const ensureCode = useRecoveryCodeStore((s) => s.ensureCode);

  const [changingPhoto, setChangingPhoto] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

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

  useEffect(() => {
    if (!isHydrating) setNameInput(displayName ?? "");
  }, [displayName, isHydrating]);

  useEffect(() => {
    ensureCode().catch(() => {});
  }, [ensureCode]);

  const fallbackName =
    (authUser as any)?.fullName ||
    (authUser as any)?.firstName ||
    (authUser as any)?.name ||
    "User";
  const name = displayName?.trim() || fallbackName;
  const email =
    (authUser as any)?.email ??
    (authUser as any)?.emailAddress ??
    (authUser as any)?.emailAddresses?.[0]?.emailAddress ??
    "Email unavailable";
  const hasAccess = Boolean(revenueCatEntitlement || promoActivated);
  const accessLabel = hasAccess ? (promoActivated ? "Promo active" : "Sigma Max Pro") : "Free plan";
  const avatarSource = avatarUri ? { uri: avatarUri } : require("../../assets/sigmamax-real-updatred-logo.jpeg");
  const gender = onboardingData.gender || "Not set";
  const ethnicity = onboardingData.ethnicity || "Not set";
  const age = typeof onboardingData.age === "number" ? String(onboardingData.age) : "Not set";

  const saveName = async () => {
    await setDisplayName(nameInput.trim());
    setNameSaved(true);
    nameInputRef.current?.blur();
    setTimeout(() => setNameSaved(false), 2000);
  };

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
      const message = err instanceof Error ? err.message : "Could not update avatar.";
      Alert.alert("Photo error", message);
    } finally {
      setChangingPhoto(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut || deletingAccount) return;
    setLoggingOut(true);
    try {
      try {
        await logoutRevenueCatUser();
      } catch (rcErr) {
        logger.warn("[Profile] RevenueCat logout failed:", rcErr);
      }
      await resetLocalUserData();
      await supabase.auth.signOut();
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed. Please try again.";
      Alert.alert("Log out", message);
    } finally {
      setLoggingOut(false);
    }
  };

  const performDelete = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      try {
        await logoutRevenueCatUser();
      } catch (rcErr) {
        logger.warn("[Profile] RevenueCat logout failed:", rcErr);
      }
      await resetLocalUserData();
      try {
        await supabase.auth.signOut();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Signed out locally after deletion.";
        Alert.alert("Sign out", message);
      }
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account locally. Please try again.";
      Alert.alert("Delete account failed", message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount || loggingOut) return;
    Alert.alert(
      "Delete account?",
      "This removes local app data from this device. Active subscriptions are handled separately and are not cancelled here.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void performDelete() },
      ],
    );
  };

  const handleRestorePurchases = async () => {
    if (restoringPurchases || isHydrating) return;
    setRestoringPurchases(true);
    try {
      await restorePurchases();
      const hasEntitlement = await checkSubscriptionStatus();
      setRevenueCatEntitlement(hasEntitlement);
      Alert.alert(
        hasEntitlement ? "Purchases restored" : "No purchases found",
        hasEntitlement
          ? "Your subscription has been restored successfully."
          : "We couldn't find any previous purchases associated with your account.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore purchases. Please try again.";
      Alert.alert("Restore failed", message);
    } finally {
      setRestoringPurchases(false);
    }
  };

  return (
    <AppGradientBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: FLOATING_TAB_BAR.contentClearance + SP[5] }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <T style={styles.eyebrow}>ACCOUNT</T>
            <T style={styles.title}>Profile</T>
            <T style={styles.subtitle}>Manage your identity, plan, and recovery access.</T>
          </View>

          <LightCard style={styles.heroCard}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Image source={avatarSource} style={styles.avatarImage} resizeMode={avatarUri ? "cover" : "contain"} />
              </View>
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.nameRow}>
                <T style={styles.heroName} numberOfLines={1}>{name}</T>
                <View style={[styles.statusPill, hasAccess && styles.statusPillActive]}>
                  <T style={[styles.statusText, hasAccess && styles.statusTextActive]}>{accessLabel}</T>
                </View>
              </View>
              <T style={styles.heroEmail} numberOfLines={1}>{email}</T>
              <ActionButton
                label={changingPhoto ? "Changing photo" : "Change photo"}
                onPress={handleChangePhoto}
                disabled={changingPhoto || deletingAccount || isHydrating}
                icon={<Camera size={17} color="#FFFFFF" strokeWidth={2.5} />}
              />
            </View>
          </LightCard>

          {isHydrating ? <T style={styles.hydratingLabel}>Loading profile...</T> : null}

          <LightCard>
            <View style={styles.sectionHeader}>
              <IconTile><UserRound size={22} color={COLORS.lightText} strokeWidth={2.4} /></IconTile>
              <View style={styles.sectionCopy}>
                <T style={styles.cardLabel}>Demographics</T>
                <T style={styles.cardSubtext}>Basic details used for your plan.</T>
              </View>
            </View>
            <View style={styles.nameEditorRow}>
              <TextInput
                ref={nameInputRef}
                style={styles.nameInput}
                value={nameInput}
                onChangeText={(v) => { setNameInput(v); setNameSaved(false); }}
                placeholder="Your name"
                placeholderTextColor={COLORS.lightSub}
                returnKeyType="done"
                onSubmitEditing={saveName}
                maxLength={30}
              />
              <Pressable onPress={saveName} style={({ pressed }) => [styles.saveChip, pressed && styles.pressed]}>
                <T style={styles.saveChipText}>{nameSaved ? "Saved" : "Save"}</T>
              </Pressable>
            </View>
            <InfoRow label="Gender" value={gender} />
            <InfoRow label="Ethnicity" value={ethnicity} />
            <InfoRow label="Age" value={age} />
          </LightCard>

          <LightCard>
            <View style={styles.sectionHeader}>
              <IconTile tone={hasAccess ? "green" : "neutral"}>
                <ReceiptText size={22} color={hasAccess ? GREEN : COLORS.lightText} strokeWidth={2.4} />
              </IconTile>
              <View style={styles.sectionCopy}>
                <T style={styles.cardLabel}>Subscription</T>
                <T style={styles.cardSubtext}>{hasAccess ? "Your access is active." : "No active subscription."}</T>
              </View>
            </View>
            <ActionButton
              label={restoringPurchases ? "Restoring purchases" : "Restore purchases"}
              onPress={handleRestorePurchases}
              disabled={restoringPurchases || isHydrating}
              icon={<ReceiptText size={17} color="#FFFFFF" strokeWidth={2.5} />}
            />
          </LightCard>

          <LightCard>
            <View style={styles.sectionHeader}>
              <IconTile tone="green"><KeyRound size={22} color={GREEN} strokeWidth={2.4} /></IconTile>
              <View style={styles.sectionCopy}>
                <T style={styles.cardLabel}>Recovery Code</T>
                <T style={styles.cardSubtext}>Use it to restore access after reinstalling.</T>
              </View>
            </View>
            {recoveryCode ? (
              <View style={styles.recoveryRow}>
                <T style={styles.recoveryCode} numberOfLines={1}>{recoveryCode}</T>
                <Pressable
                  style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(recoveryCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    } catch {}
                  }}
                >
                  <Copy size={16} color={COLORS.lightText} strokeWidth={2.4} />
                  <T style={styles.copyBtnText}>{codeCopied ? "Copied" : "Copy"}</T>
                </Pressable>
              </View>
            ) : (
              <T style={styles.generatingLabel}>{generating ? "Generating your code..." : "Loading..."}</T>
            )}
          </LightCard>

          <Pressable
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync("https://third-tamarillo-756.notion.site/Privacy-Policy-30266c2b427680a29ba5e586b5913999")}
            style={({ pressed }) => [styles.privacyCard, pressed && styles.pressed]}
          >
            <IconTile><ShieldCheck size={21} color={COLORS.lightText} strokeWidth={2.4} /></IconTile>
            <View style={styles.sectionCopy}>
              <T style={styles.privacyTitle}>Privacy Policy</T>
              <T style={styles.cardSubtext}>Review data and account terms.</T>
            </View>
          </Pressable>

          <LightCard style={styles.dangerCard}>
            <View style={styles.sectionHeader}>
              <IconTile tone="danger"><Trash2 size={22} color={COLORS.declineRed} strokeWidth={2.4} /></IconTile>
              <View style={styles.sectionCopy}>
                <T style={styles.cardLabel}>Account actions</T>
                <T style={styles.cardSubtext}>Sign out or clear this device.</T>
              </View>
            </View>
            <View style={styles.actionStack}>
              <ActionButton
                label="Delete account"
                variant="danger"
                onPress={handleDeleteAccount}
                disabled={deletingAccount || loggingOut || isHydrating}
                icon={<Trash2 size={17} color={COLORS.declineRed} strokeWidth={2.5} />}
              />
              <ActionButton
                label={loggingOut ? "Logging out" : "Log out"}
                onPress={handleLogout}
                disabled={loggingOut || deletingAccount || isHydrating}
                icon={<LogOut size={17} color="#FFFFFF" strokeWidth={2.5} />}
              />
            </View>
          </LightCard>
        </ScrollView>
      </SafeAreaView>
    </AppGradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    gap: SP[4],
  },
  header: {
    alignItems: "center",
    paddingHorizontal: SP[5],
    gap: SP[1],
  },
  eyebrow: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 1,
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(34),
    lineHeight: ms(38),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    padding: SP[4],
    ...SOFT_SHADOW,
  },
  heroCard: {
    minHeight: sh(148),
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
    padding: SP[5],
  },
  avatarRing: {
    width: ms(106),
    height: ms(106),
    borderRadius: ms(53),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  avatarInner: {
    width: ms(92),
    height: ms(92),
    borderRadius: ms(46),
    overflow: "hidden",
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: SP[2],
  },
  nameRow: {
    gap: SP[2],
  },
  heroName: {
    color: COLORS.lightText,
    fontFamily: FONT,
    fontSize: ms(25),
    lineHeight: ms(29),
    letterSpacing: 0,
  },
  heroEmail: {
    color: COLORS.lightSub,
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
    paddingHorizontal: SP[3],
    paddingVertical: 5,
  },
  statusPillActive: {
    backgroundColor: "#EEF8DE",
  },
  statusText: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 0.2,
  },
  statusTextActive: {
    color: GREEN,
  },
  hydratingLabel: {
    color: COLORS.lightSub,
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[4],
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: RADII.md,
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileGreen: {
    backgroundColor: "#EEF8DE",
  },
  iconTileDanger: {
    backgroundColor: COLORS.declineRedSoft,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardLabel: {
    color: COLORS.lightText,
    fontFamily: FONT,
    fontSize: ms(19),
    lineHeight: ms(23),
    letterSpacing: 0,
  },
  cardSubtext: {
    marginTop: 3,
    color: COLORS.lightSub,
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    lineHeight: ms(18),
  },
  nameEditorRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    borderTopWidth: 1,
    borderTopColor: COLORS.lightHairline,
  },
  nameInput: {
    flex: 1,
    color: COLORS.lightText,
    fontFamily: DETAIL_FONT,
    fontSize: ms(16),
    paddingVertical: 0,
  },
  saveChip: {
    minHeight: 36,
    minWidth: 68,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[3],
  },
  saveChipText: {
    color: COLORS.lightText,
    fontFamily: FONT,
    fontSize: ms(13),
  },
  infoRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.lightHairline,
    gap: SP[3],
  },
  infoLabel: {
    color: COLORS.lightSub,
    fontFamily: DETAIL_FONT,
    fontSize: ms(14),
  },
  infoValue: {
    flex: 1,
    color: COLORS.lightText,
    fontFamily: DETAIL_FONT,
    fontSize: ms(15),
    textAlign: "right",
  },
  actionButton: {
    minHeight: 52,
    borderRadius: RADII.circle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    paddingHorizontal: SP[5],
  },
  actionIcon: {
    width: 20,
    alignItems: "center",
  },
  actionButtonText: {
    fontFamily: FONT,
    fontSize: ms(14),
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pressed: {
    opacity: 0.78,
  },
  recoveryRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.lightHairline,
  },
  recoveryCode: {
    flex: 1,
    color: COLORS.lightText,
    fontFamily: DETAIL_FONT,
    fontSize: ms(18),
    letterSpacing: 2,
  },
  copyBtn: {
    minHeight: 40,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[1],
    paddingHorizontal: SP[3],
  },
  copyBtnText: {
    color: COLORS.lightText,
    fontFamily: FONT,
    fontSize: ms(13),
  },
  generatingLabel: {
    color: COLORS.lightSub,
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    borderTopWidth: 1,
    borderTopColor: COLORS.lightHairline,
    paddingTop: SP[3],
  },
  privacyCard: {
    minHeight: 82,
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    padding: SP[4],
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    ...SOFT_SHADOW,
  },
  privacyTitle: {
    color: COLORS.lightText,
    fontFamily: FONT,
    fontSize: ms(17),
  },
  dangerCard: {
    marginTop: SP[1],
  },
  actionStack: {
    gap: SP[3],
  },
});

