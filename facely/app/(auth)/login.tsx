// facely/app/(auth)/login.tsx
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSignIn, useSignUp, getClerkInstance } from "@clerk/clerk-expo";

import Screen from "@/components/layout/Screen";
import GlassBtn from "@/components/ui/GlassBtn";
import { FieldInput, FieldLabel } from "@/components/ui/FieldGroup";
import { COLORS, SP } from "@/lib/tokens";
import { useAuthStore } from "@/store/auth";

type Mode = "signIn" | "signUp";
type Step = "credentials" | "signUpVerifyEmail" | "signInSecondFactor";
type EmailCodeSecondFactor = { strategy: "email_code"; emailAddressId: string };

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmailCodeSecondFactor(value: unknown): value is EmailCodeSecondFactor {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.strategy === "email_code" && typeof v.emailAddressId === "string" && v.emailAddressId.length > 0;
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
  const userEmail = useAuthStore((state) => state.user?.email ?? null);

  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  const [mode, setMode] = useState<Mode>("signIn");
  const [step, setStep] = useState<Step>("credentials");

  const [email, setEmail] = useState(userEmail ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const clerkReady = signInLoaded && signUpLoaded;

  const canSubmitCredentials = useMemo(() => {
    if (submitting || !clerkReady) return false;
    if (!isValidEmail(email)) return false;
    if (password.length < 8) return false;
    if (mode === "signUp" && password !== passwordConfirm) return false;
    return true;
  }, [clerkReady, email, mode, password, passwordConfirm, submitting]);

  const modeLabel = useMemo(() => (mode === "signIn" ? "Sign in" : "Create account"), [mode]);

  const resetFormState = useCallback(() => {
    setStep("credentials");
    setPassword("");
    setPasswordConfirm("");
    setVerificationCode("");
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

  const activateSession = useCallback(async (createdSessionId: string, origin: "signIn" | "signUp") => {
    const setActive = origin === "signIn" ? setActiveSignIn : setActiveSignUp;
    await setActive?.({ session: createdSessionId });
    router.replace("/(onboarding)/welcome");
  }, [setActiveSignIn, setActiveSignUp]);

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
    if (!clerkReady) {
      setErrorText("Authentication is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signIn") {
        if (!signIn) throw new Error("Sign-in is unavailable.");
        const result = await signIn.create({ strategy: "password", identifier: normalizedEmail, password });

        console.log("[DEBUG] signIn.create result:", {
          status: result.status,
          createdSessionId: result.createdSessionId,
          supportedSecondFactors: result.supportedSecondFactors,
        });

        if (result.status === "complete" && result.createdSessionId) {
          await activateSession(result.createdSessionId, "signIn");
          return;
        }

        if (result.status === "needs_second_factor") {
          const factors = (result.supportedSecondFactors ?? []) as unknown[];
          const emailSecondFactor = factors.find(isEmailCodeSecondFactor);
          if (emailSecondFactor) {
            await result.prepareSecondFactor({
              strategy: "email_code",
              emailAddressId: emailSecondFactor.emailAddressId,
            });
            setStep("signInSecondFactor");
            return;
          }
          throw new Error("Additional verification is required. Enable an email second factor in Clerk or disable Client Trust.");
        }

        throw new Error(`Sign-in did not complete. Status: ${result.status}`);
      }

      if (!signUp) throw new Error("Sign-up is unavailable.");

      console.log("[DEBUG] Calling signUp.create with:", { emailAddress: normalizedEmail, password: "***" });

      // Check Clerk environment - this reveals if Clerk connected to its backend
      const clerk = getClerkInstance();
      console.log("[DEBUG] Clerk loaded:", clerk.loaded);
      console.log("[DEBUG] Clerk environment.displayConfig.id:", clerk.environment?.displayConfig?.id);
      console.log("[DEBUG] Clerk environment.displayConfig.applicationName:", clerk.environment?.displayConfig?.applicationName);
      console.log("[DEBUG] Clerk client.createdAt:", clerk.client?.createdAt);

      // If environment is empty, Clerk hasn't connected to its API
      if (!clerk.environment?.displayConfig?.id) {
        console.log("[DEBUG] WARNING: Clerk environment not loaded! API connection issue.");

        // Try to manually fetch from Clerk API to test connectivity
        const clerkDomain = "clerk.sigmamax.app"; // from your publishable key
        try {
          console.log("[DEBUG] Testing Clerk API connectivity...");
          const testResponse = await fetch(`https://${clerkDomain}/v1/environment`, {
            headers: {
              "Content-Type": "application/json",
            },
          });
          console.log("[DEBUG] Clerk API test response status:", testResponse.status);
          const testData = await testResponse.text();
          console.log("[DEBUG] Clerk API test response:", testData.substring(0, 500));
        } catch (fetchError) {
          console.log("[DEBUG] Clerk API fetch error:", fetchError);
        }
      }

      // Try the sign-up anyway
      const result = await signUp.create({ emailAddress: normalizedEmail, password });
      console.log("[DEBUG] result.status:", result?.status);
      console.log("[DEBUG] result.createdSessionId:", result?.createdSessionId);

      const signUpAttempt = result || signUp;

      // If sign-up is complete (no verification required), activate session immediately
      if (signUpAttempt.status === "complete" && signUpAttempt.createdSessionId) {
        await setActiveSignUp?.({ session: signUpAttempt.createdSessionId });
        router.replace("/(onboarding)/welcome");
        return;
      }

      // If email verification is required, prepare it and show verification screen
      if (signUpAttempt.status === "missing_requirements" &&
          signUpAttempt.unverifiedFields?.includes("email_address")) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("signUpVerifyEmail");
        return;
      }

      throw new Error(`Sign-up did not complete. Status: ${signUpAttempt.status}`);
    } catch (err) {
      console.log("[DEBUG] Auth error caught:", err);
      console.log("[DEBUG] Error details:", JSON.stringify(err, null, 2));
      setErrorText(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [activateSession, clerkReady, email, mode, password, passwordConfirm, setActiveSignUp, signIn, signUp, submitting]);

  const submitVerificationCode = useCallback(async () => {
    if (submitting) return;
    setErrorText(null);
    if (!clerkReady) {
      setErrorText("Authentication is still loading. Try again in a moment.");
      return;
    }

    const code = verificationCode.trim();
    if (!code) {
      setErrorText("Enter the code.");
      return;
    }

    setSubmitting(true);
    try {
      if (step === "signUpVerifyEmail") {
        if (!signUp) throw new Error("Sign-up is unavailable.");
        const signUpAttempt = await signUp.attemptEmailAddressVerification({ code });

        console.log("[DEBUG] attemptEmailAddressVerification result:", {
          status: signUpAttempt.status,
          createdSessionId: signUpAttempt.createdSessionId,
        });

        if (signUpAttempt.status === "complete") {
          await setActiveSignUp?.({ session: signUpAttempt.createdSessionId });
          router.replace("/(onboarding)/welcome");
          return;
        }
        throw new Error(`Email verification did not complete. Status: ${signUpAttempt.status}`);
      }

      if (step === "signInSecondFactor") {
        if (!signIn) throw new Error("Sign-in is unavailable.");
        const signInAttempt = await signIn.attemptSecondFactor({ strategy: "email_code", code });

        console.log("[DEBUG] attemptSecondFactor result:", {
          status: signInAttempt.status,
          createdSessionId: signInAttempt.createdSessionId,
        });

        if (signInAttempt.status === "complete") {
          await setActiveSignIn?.({ session: signInAttempt.createdSessionId });
          router.replace("/(onboarding)/welcome");
          return;
        }
        throw new Error(`Verification did not complete. Status: ${signInAttempt.status}`);
      }
    } catch (err) {
      setErrorText(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [clerkReady, setActiveSignIn, setActiveSignUp, signIn, signUp, step, submitting, verificationCode]);

  if (status === "authenticated") {
    router.replace("/(onboarding)/welcome");
    return null;
  }

  const headerSubtitle =
    step === "credentials"
      ? mode === "signIn"
        ? "Sign in with your email and password."
        : "Create an account with your email and password."
      : "Enter the code we sent to your email.";

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
          disabled={submitting}
          style={[styles.segmentItem, mode === "signUp" ? styles.segmentItemActive : null]}
        >
          <Text style={[styles.segmentText, mode === "signUp" ? styles.segmentTextActive : null]}>
            Sign up
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
