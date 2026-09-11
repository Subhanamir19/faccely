import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LogOut,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react-native";

import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { APP_SCREEN_BG } from "@/components/layout/AppGradientBackground";
import T from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms } from "@/lib/responsive";
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

const FONT = "DINNextRounded-Bold";
const DETAIL_FONT = "DINNextRounded-Regular";
const GREEN = "#4D9800";
const INK = "#171512";
const SECONDARY = "#736E67";
const GROUP_BG = "#F7F6F3";
const SEPARATOR = "rgba(23,21,18,0.09)";

const PROFILE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isLiquidGlassAvailable() &&
  isGlassEffectAPIAvailable();

function useReduceTransparency() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);

  return reduced;
}

function CameraMaterial({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  if (PROFILE_LIQUID_GLASS && !reduced) {
    return (
      <GlassView
        glassEffectStyle="clear"
        tintColor="rgba(255,255,255,0.18)"
        pointerEvents="none"
        style={styles.cameraMaterial}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.cameraMaterial, reduced && styles.cameraMaterialSolid]}
    >
      {!reduced && (
        <BlurView
          tint="systemUltraThinMaterialLight"
          intensity={Platform.OS === "android" ? 28 : 64}
          blurMethod="dimezisBlurView"
          blurReductionFactor={3}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View pointerEvents="none" style={styles.cameraMaterialTint} />
      {children}
    </View>
  );
}

function SettingsSection({
  label,
  footer,
  children,
}: {
  label: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <T style={styles.sectionLabel}>{label}</T>
      <View style={styles.group}>{children}</View>
      {footer ? <T style={styles.sectionFooter}>{footer}</T> : null}
    </View>
  );
}

function GroupDivider({ inset = 16 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

function RowIcon({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "danger";
}) {
  return (
    <View
      style={[
        styles.rowIcon,
        tone === "green" && styles.rowIconGreen,
        tone === "danger" && styles.rowIconDanger,
      ]}
    >
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  value,
  caption,
  icon,
  trailing,
  onPress,
  disabled = false,
  danger = false,
  accessibilityRole = "button",
}: {
  label: string;
  value?: string;
  caption?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityRole?: "button" | "link";
}) {
  const content = (
    <>
      {icon}
      <View style={styles.rowCopy}>
        <T style={[styles.rowLabel, danger && styles.dangerText]}>{label}</T>
        {caption ? <T style={styles.rowCaption}>{caption}</T> : null}
      </View>
      {value ? (
        <T style={styles.rowValue} numberOfLines={2} selectable>
          {value}
        </T>
      ) : null}
      {trailing}
    </>
  );

  if (!onPress) return <View style={styles.settingsRow}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.settingsRow,
        disabled && styles.rowDisabled,
        pressed && !disabled && styles.rowPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <T style={styles.infoLabel}>{label}</T>
      <T style={styles.infoValue} numberOfLines={2} selectable>{value}</T>
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
  const insets = useSafeAreaInsets();
  const reduceTransparency = useReduceTransparency();
  const authUser = useAuthStore((state) => state.user);
  const onboardingData = useOnboarding((state) => state.data);
  const hydrateOnboarding = useOnboarding((state) => state.hydrate);
  const avatarUri = useProfile((state) => state.avatarUri);
  const displayName = useProfile((state) => state.displayName);
  const hydrateProfile = useProfile((state) => state.hydrate);
  const setProfileAvatar = useProfile((state) => state.setAvatar);
  const setDisplayName = useProfile((state) => state.setDisplayName);
  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
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
  const hasAccess = Boolean(revenueCatEntitlement);
  const accessLabel = hasAccess ? "Sigma Max Pro" : "Free plan";
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
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={APP_SCREEN_BG} />
      {/* The name field sits mid-list; without this the keyboard covers it. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "android" ? insets.top + 12 : 12,
            paddingBottom: FLOATING_TAB_BAR.contentClearance + SP[6],
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentColumn}>
          <T style={styles.title}>Profile</T>

          <View style={styles.identity}>
            <Pressable
              onPress={handleChangePhoto}
              disabled={changingPhoto || deletingAccount || isHydrating}
              accessibilityRole="button"
              accessibilityLabel={changingPhoto ? "Changing profile photo" : "Change profile photo"}
              accessibilityState={{ disabled: changingPhoto || deletingAccount || isHydrating }}
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && styles.avatarPressed,
              ]}
            >
              <View style={styles.avatarFrame}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <UserRound size={42} color="#8B867F" strokeWidth={1.8} />
                  </View>
                )}
              </View>
              <CameraMaterial reduced={reduceTransparency}>
                <View style={styles.cameraMaterialContent}>
                  {changingPhoto ? (
                    <ActivityIndicator size="small" color={INK} />
                  ) : (
                    <Camera size={17} color={INK} strokeWidth={2.35} />
                  )}
                </View>
              </CameraMaterial>
            </Pressable>

            <View style={styles.identityCopy}>
              <T style={styles.identityName} numberOfLines={2}>{name}</T>
              <T style={styles.identityEmail} numberOfLines={1} selectable>{email}</T>
            </View>

            <View style={[styles.planPill, hasAccess && styles.planPillActive]}>
              {isHydrating ? (
                <ActivityIndicator size="small" color={SECONDARY} />
              ) : (
                <T style={[styles.planPillText, hasAccess && styles.planPillTextActive]}>
                  {accessLabel}
                </T>
              )}
            </View>
          </View>

          <SettingsSection label="PERSONAL">
            <View style={styles.nameEditorRow}>
              <View style={styles.nameEditorCopy}>
                <T style={styles.inputLabel}>Name</T>
                <TextInput
                  ref={nameInputRef}
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={(v) => { setNameInput(v); setNameSaved(false); }}
                  placeholder="Your name"
                  placeholderTextColor={SECONDARY}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  maxLength={30}
                  editable={!isHydrating}
                  accessibilityLabel="Name"
                  accessibilityState={{ disabled: isHydrating }}
                  selectionColor={INK}
                />
              </View>
              <Pressable
                onPress={saveName}
                disabled={isHydrating}
                accessibilityRole="button"
                accessibilityLabel={nameSaved ? "Name saved" : "Save name"}
                accessibilityState={{ disabled: isHydrating }}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.saveButton,
                  nameSaved && styles.saveButtonComplete,
                  isHydrating && styles.rowDisabled,
                  pressed && styles.compactPressed,
                ]}
              >
                {nameSaved ? <Check size={15} color={GREEN} strokeWidth={2.6} /> : null}
                <T style={[styles.saveButtonText, nameSaved && styles.saveButtonTextComplete]}>
                  {nameSaved ? "Saved" : "Save"}
                </T>
              </Pressable>
            </View>
            <GroupDivider />
            <InfoRow label="Gender" value={gender} />
            <GroupDivider />
            <InfoRow label="Ethnicity" value={ethnicity} />
            <GroupDivider />
            <InfoRow label="Age" value={age} />
          </SettingsSection>

          <SettingsSection
            label="MEMBERSHIP"
            footer="Restoring purchases never creates a new charge."
          >
            <SettingsRow
              label="Current plan"
              value={accessLabel}
              icon={
                <RowIcon tone={hasAccess ? "green" : "neutral"}>
                  <ReceiptText size={17} color={hasAccess ? GREEN : INK} strokeWidth={2.2} />
                </RowIcon>
              }
            />
            <GroupDivider inset={62} />
            <SettingsRow
              label={restoringPurchases ? "Restoring purchases…" : "Restore purchases"}
              caption={hasAccess ? "Check this account for previous purchases" : undefined}
              icon={
                <RowIcon>
                  <RefreshCw size={17} color={INK} strokeWidth={2.2} />
                </RowIcon>
              }
              trailing={
                restoringPurchases ? (
                  <ActivityIndicator size="small" color={SECONDARY} />
                ) : null
              }
              onPress={handleRestorePurchases}
              disabled={restoringPurchases || isHydrating}
            />
          </SettingsSection>

          <SettingsSection
            label="SECURITY"
            footer="Keep your recovery code somewhere private."
          >
            <View style={styles.recoveryRow}>
              <RowIcon tone="green">
                <KeyRound size={17} color={GREEN} strokeWidth={2.2} />
              </RowIcon>
              <View style={styles.recoveryCopy}>
                <T style={styles.rowLabel}>Recovery code</T>
                {recoveryCode ? (
                  <T style={styles.recoveryCode} numberOfLines={1} selectable>{recoveryCode}</T>
                ) : (
                  <T style={styles.rowCaption}>
                    {generating ? "Generating your code…" : "Loading…"}
                  </T>
                )}
              </View>
              {recoveryCode ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={codeCopied ? "Recovery code copied" : "Copy recovery code"}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.copyButton,
                    codeCopied && styles.copyButtonComplete,
                    pressed && styles.compactPressed,
                  ]}
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(recoveryCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    } catch {}
                  }}
                >
                  {codeCopied ? (
                    <Check size={16} color={GREEN} strokeWidth={2.5} />
                  ) : (
                    <Copy size={16} color={INK} strokeWidth={2.3} />
                  )}
                  <T style={[styles.copyButtonText, codeCopied && styles.copyButtonTextComplete]}>
                    {codeCopied ? "Copied" : "Copy"}
                  </T>
                </Pressable>
              ) : (
                <ActivityIndicator size="small" color={SECONDARY} />
              )}
            </View>
            <GroupDivider inset={62} />
            <SettingsRow
              label="Privacy Policy"
              caption="How your data and account are handled"
              icon={
                <RowIcon>
                  <ShieldCheck size={17} color={INK} strokeWidth={2.2} />
                </RowIcon>
              }
              trailing={<ExternalLink size={17} color="#8A857E" strokeWidth={2.1} />}
              onPress={() => WebBrowser.openBrowserAsync("https://third-tamarillo-756.notion.site/Privacy-Policy-30266c2b427680a29ba5e586b5913999")}
              accessibilityRole="link"
            />
          </SettingsSection>

          <SettingsSection label="ACCOUNT">
            <SettingsRow
              label={loggingOut ? "Signing out…" : "Sign Out"}
              icon={
                <RowIcon tone="danger">
                  <LogOut size={17} color={COLORS.declineRed} strokeWidth={2.2} />
                </RowIcon>
              }
              trailing={loggingOut ? <ActivityIndicator size="small" color={COLORS.declineRed} /> : null}
              onPress={handleLogout}
              disabled={loggingOut || deletingAccount || isHydrating}
              danger
            />
            <GroupDivider inset={62} />
            <SettingsRow
              label={deletingAccount ? "Deleting account…" : "Delete Account"}
              caption="Removes local app data from this device"
              icon={
                <RowIcon tone="danger">
                  <Trash2 size={17} color={COLORS.declineRed} strokeWidth={2.2} />
                </RowIcon>
              }
              trailing={deletingAccount ? <ActivityIndicator size="small" color={COLORS.declineRed} /> : null}
              onPress={handleDeleteAccount}
              disabled={deletingAccount || loggingOut || isHydrating}
              danger
            />
          </SettingsSection>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_SCREEN_BG,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SP[5],
  },
  contentColumn: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 28,
  },
  title: {
    color: INK,
    fontFamily: FONT,
    fontSize: ms(34),
    lineHeight: ms(39),
    letterSpacing: -0.65,
  },
  identity: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 2,
  },
  avatarButton: {
    position: "relative",
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  avatarPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.975 }],
  },
  avatarFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: "#ECEAE6",
    borderWidth: 1,
    borderColor: "rgba(23,21,18,0.08)",
    boxShadow: "0 9px 22px rgba(23, 18, 12, 0.13)",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0EEEA",
  },
  cameraMaterial: {
    position: "absolute",
    right: 1,
    bottom: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.56)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.92)",
    boxShadow: "0 5px 12px rgba(23, 18, 12, 0.16)",
  },
  cameraMaterialSolid: {
    backgroundColor: "#FFFFFF",
  },
  cameraMaterialTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  cameraMaterialContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: {
    maxWidth: "92%",
    alignItems: "center",
    gap: 2,
  },
  identityName: {
    color: INK,
    fontFamily: FONT,
    fontSize: ms(24),
    lineHeight: ms(29),
    letterSpacing: -0.25,
    textAlign: "center",
  },
  identityEmail: {
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(14),
    lineHeight: ms(19),
    textAlign: "center",
  },
  planPill: {
    minHeight: 28,
    minWidth: 72,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEDE9",
  },
  planPillActive: {
    backgroundColor: "#EDF6E4",
  },
  planPillText: {
    color: SECONDARY,
    fontFamily: FONT,
    fontSize: ms(11.5),
    lineHeight: ms(15),
    letterSpacing: 0.08,
  },
  planPillTextActive: {
    color: GREEN,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    paddingHorizontal: 12,
    color: SECONDARY,
    fontFamily: FONT,
    fontSize: ms(11.5),
    lineHeight: ms(15),
    letterSpacing: 0.85,
  },
  group: {
    overflow: "hidden",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: GROUP_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(23,21,18,0.07)",
  },
  sectionFooter: {
    paddingHorizontal: 12,
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(12),
    lineHeight: ms(17),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SEPARATOR,
  },
  settingsRow: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowPressed: {
    backgroundColor: "#ECEAE6",
  },
  rowDisabled: {
    opacity: 0.48,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderCurve: "continuous",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAE8E4",
  },
  rowIconGreen: {
    backgroundColor: "#EAF4DF",
  },
  rowIconDanger: {
    backgroundColor: COLORS.declineRedSoft,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    color: INK,
    fontFamily: DETAIL_FONT,
    fontSize: ms(16),
    lineHeight: ms(21),
  },
  rowCaption: {
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(12.5),
    lineHeight: ms(17),
  },
  rowValue: {
    maxWidth: "44%",
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(14.5),
    lineHeight: ms(19),
    textAlign: "right",
  },
  dangerText: {
    color: COLORS.declineRed,
  },
  nameEditorRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nameEditorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  inputLabel: {
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(12),
    lineHeight: ms(16),
  },
  nameInput: {
    minHeight: 30,
    color: INK,
    fontFamily: DETAIL_FONT,
    fontSize: ms(16),
    lineHeight: ms(21),
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  saveButton: {
    minWidth: 70,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(23,21,18,0.10)",
  },
  saveButtonComplete: {
    backgroundColor: "#EDF6E4",
    borderColor: "rgba(77,152,0,0.14)",
  },
  saveButtonText: {
    color: INK,
    fontFamily: FONT,
    fontSize: ms(13),
    lineHeight: ms(17),
  },
  saveButtonTextComplete: {
    color: GREEN,
  },
  compactPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  infoRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  infoLabel: {
    color: INK,
    fontFamily: DETAIL_FONT,
    fontSize: ms(16),
    lineHeight: ms(21),
  },
  infoValue: {
    flex: 1,
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(14.5),
    lineHeight: ms(19),
    textAlign: "right",
  },
  recoveryRow: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recoveryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recoveryCode: {
    color: SECONDARY,
    fontFamily: DETAIL_FONT,
    fontSize: ms(14),
    lineHeight: ms(18),
    letterSpacing: 1.15,
    fontVariant: ["tabular-nums"],
  },
  copyButton: {
    minHeight: 44,
    minWidth: 76,
    borderRadius: 22,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(23,21,18,0.10)",
  },
  copyButtonComplete: {
    backgroundColor: "#EDF6E4",
    borderColor: "rgba(77,152,0,0.14)",
  },
  copyButtonText: {
    color: INK,
    fontFamily: FONT,
    fontSize: ms(12.5),
    lineHeight: ms(16),
  },
  copyButtonTextComplete: {
    color: GREEN,
  },
});
