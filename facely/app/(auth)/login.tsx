// facely/app/(auth)/login.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/layout/Screen";
import GlassBtn from "@/components/ui/GlassBtn";
import { FieldInput, FieldLabel } from "@/components/ui/FieldGroup";
import { COLORS, SP } from "@/lib/tokens";
import { supabase } from "@/lib/supabase/client";
import { syncUserProfile } from "@/lib/api/user";
import { useAuthStore } from "@/store/auth";

type Mode = "signIn" | "signUp";

type ParamValue = string | string[] | undefined;

function takeFirst(value?: ParamValue): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  if (!domain || domain.startsWith(".") || domain.endsWith(".")) return false;
  return domain.includes(".");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const anyErr = error as any;
    const clerkErrors = anyErr?.errors;
    if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
      const msg = clerkErrors[0]?.longMessage ?? clerkErrors[0]?.message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }
  return "Something went wrong. Please try again.";
}

export default function LoginScreen() {
  const status = useAuthStore((state) => state.status);
  const initialized = useAuthStore((state) => state.initialized);
  const isAnonymous = useAuthStore((state) => state.isAnonymous);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);
  const params = useLocalSearchParams<{ redirectTo?: ParamValue }>();
  const redirectTo = takeFirst(params.redirectTo);

  const [mode, setMode] = useState<Mode>(() => (isAnonymous ? "signUp" : "signIn"));

  const [email, setEmail] = useState(userEmail ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Legacy UI bits kept minimal; the Supabase flow only uses credentials.
  const clerkReady = initialized;
  const step = "credentials" as const;

  useEffect(() => {
    if (!initialized) return;
    if (!isAnonymous && mode === "signUp") setMode("signIn");
    if (isAnonymous && mode === "signIn" && !userEmail) setMode("signUp");
  }, [initialized, isAnonymous, mode, userEmail]);

  const canSubmitCredentials = useMemo(() => {
    if (submitting || !initialized) return false;
    if (!isValidEmail(email)) return false;
    if (password.length < 8) return false;
    if (mode === "signUp" && password !== passwordConfirm) return false;
    return true;
  }, [email, initialized, mode, password, passwordConfirm, submitting]);

  const modeLabel = useMemo(() => (mode === "signIn" ? "Sign in" : "Create account"), [mode]);

  const resetFormState = useCallback(() => {
    setPassword("");
    setPasswordConfirm("");
    setErrorText(null);
  }, []);

  const switchMode = useCallback(
    (next: Mode) => {
      if (submitting) return;
      setMode(next);
      resetFormState();
    },
    [resetFormState, submitting]
  );

  const submitCredentials = useCallback(async () => {
    if (submitting) return;
    setErrorText(null);

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setErrorText("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErrorText("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signUp" && password !== passwordConfirm) {
      setErrorText("Passwords do not match.");
      return;
    }
    if (!initialized) {
      setErrorText("Authentication is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
      } else {
        if (!isAnonymous) {
          setErrorText("You are already signed in. Use Sign in instead.");
          return;
        }
        const { error } = await supabase.auth.updateUser({
          email: normalizedEmail,
          password,
        });
        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("already") && msg.includes("registered")) {
            setMode("signIn");
            setErrorText("That email already has an account. Please sign in instead.");
            return;
          }
          throw error;
        }
      }

      await syncUserProfile();

      if (redirectTo && redirectTo.startsWith("/")) {
        router.replace(redirectTo as any);
        return;
      }

      const canGoBack =
        typeof router.canGoBack === "function" ? router.canGoBack() : false;
      if (canGoBack) {
        router.back();
        return;
      }

      router.replace("/(tabs)/take-picture");
    } catch (err) {
      setErrorText(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [email, initialized, isAnonymous, mode, password, passwordConfirm, redirectTo, submitting]);

  const submitVerificationCode = useCallback(async () => {
    // Legacy no-op (Clerk-only). Supabase does not require email codes in this setup.
  }, []);

  const headerSubtitle =
    mode === "signIn"
      ? "Sign in with your email and password."
      : "Create an account with your email and password.";

  return (
    <Screen scroll keyboardAware contentContainerStyle={styles.content}>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{mode === "signIn" ? "Welcome back" : "Create your account"}</Text>
        <Text style={styles.subtitle}>{headerSubtitle}</Text>
      </View>

      <View style={styles.segment}>
        <Pressable
          onPress={() => switchMode("signIn")}
          disabled={submitting}
          style={[styles.segmentItem, mode === "signIn" ? styles.segmentItemActive : null]}
        >
          <Text style={[styles.segmentText, mode === "signIn" ? styles.segmentTextActive : null]}>
            Sign in
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchMode("signUp")}
          disabled={submitting || !isAnonymous}
          style={[styles.segmentItem, mode === "signUp" ? styles.segmentItemActive : null]}
        >
          <Text style={[styles.segmentText, mode === "signUp" ? styles.segmentTextActive : null]}>
            Create
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {step === "credentials" ? (
          <>
            <View style={styles.field}>
              <FieldLabel>Email</FieldLabel>
              <FieldInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                editable={!submitting}
                onChangeText={setEmail}
                placeholder="you@example.com"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <FieldLabel>Password</FieldLabel>
              <FieldInput
                value={password}
                editable={!submitting}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                textContentType={mode === "signIn" ? "password" : "newPassword"}
                autoCapitalize="none"
                returnKeyType={mode === "signUp" ? "next" : "done"}
              />
            </View>

            {mode === "signUp" ? (
              <View style={styles.field}>
                <FieldLabel>Confirm password</FieldLabel>
                <FieldInput
                  value={passwordConfirm}
                  editable={!submitting}
                  onChangeText={setPasswordConfirm}
                  placeholder="••••••••"
                  secureTextEntry
                  textContentType="newPassword"
                  autoCapitalize="none"
                  returnKeyType="done"
                />
              </View>
            ) : null}

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.actions}>
              <GlassBtn
                label={
                  submitting
                    ? `${modeLabel}...`
                    : clerkReady
                      ? modeLabel
                      : "Loading..."
                }
                onPress={() => void submitCredentials()}
                disabled={!canSubmitCredentials}
                variant="primary"
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <FieldLabel>Verification code</FieldLabel>
              <FieldInput
                value={verificationCode}
                editable={!submitting}
                onChangeText={setVerificationCode}
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.actionsRow}>
              <GlassBtn
                label="Back"
                onPress={resetFormState}
                disabled={submitting}
                variant="glass"
              />
              <GlassBtn
                label={submitting ? "Verifying..." : "Verify"}
                onPress={() => void submitVerificationCode()}
                disabled={submitting || !verificationCode.trim()}
                variant="primary"
              />
            </View>
          </>
        )}
      </View>

      {!clerkReady ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.text} />
          <Text style={styles.loadingText}>Loading authentication…</Text>
        </View>
      ) : null}

      <Text style={styles.statusLabel}>
        Status: {status}
        {userEmail ? ` (${userEmail})` : ""}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: SP[6],
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    width: "25%",
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  header: {
    marginTop: 32,
    marginBottom: SP[6],
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SP[2],
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.sub,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 999,
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "#1B1B1B",
    overflow: "hidden",
    marginBottom: SP[4],
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: "#171717",
  },
  segmentText: {
    color: COLORS.sub,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  card: {
    padding: SP[5],
    borderRadius: 20,
    backgroundColor: COLORS.bgBottom,
    borderWidth: 1,
    borderColor: "#141414",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  field: {
    marginBottom: SP[4],
  },
  actions: {
    marginTop: SP[2],
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: SP[2],
  },
  errorText: {
    color: "#FF7777",
    marginTop: SP[2],
    marginBottom: SP[2],
  },
  loadingRow: {
    marginTop: SP[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 10,
    color: COLORS.sub,
  },
  statusLabel: {
    marginTop: SP[5],
    color: COLORS.sub,
    textAlign: "center",
  },
});
