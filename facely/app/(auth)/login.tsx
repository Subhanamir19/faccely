// facely/app/(auth)/login.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as AuthSession from "expo-auth-session";
import { useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
  const status = useAuthStore((state) => state.status);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);
  const { signIn, isLoaded: signInLoaded, setActive: setActiveSignIn } = useSignIn();
  const { signUp, isLoaded: signUpLoaded, setActive: setActiveSignUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const googleEnabled = true;

  const handlePrimaryEmailAction = useCallback(async () => {
    const trimmedEmail = email.trim();

    setEmailSubmitting(true);
    try {
      if (mode === "signIn") {
        if (!signInLoaded || !signIn) {
          throw new Error("Sign-in is not ready. Please try again.");
        }

        const attempt = await signIn.create({
          identifier: trimmedEmail,
          password,
        });

        if (attempt.status === "complete") {
          await setActiveSignIn?.({ session: attempt.createdSessionId });
          router.replace("/(onboarding)/welcome");
        } else {
          throw new Error("Unable to complete sign-in. Please try again.");
        }
      } else {
        if (!signUpLoaded || !signUp) {
          throw new Error("Sign-up is not ready. Please try again.");
        }

        const created = await signUp.create({
          emailAddress: trimmedEmail,
          password,
        });

        if (created.status === "complete") {
          await setActiveSignUp?.({ session: created.createdSessionId });
          router.replace("/(onboarding)/welcome");
        } else {
          throw new Error("Unable to complete sign-up. Please try again.");
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const title = mode === "signIn" ? "Sign in failed" : "Sign up failed";
      Alert.alert(title, reason);
    } finally {
      setEmailSubmitting(false);
    }
  }, [email, password, mode, signIn, signInLoaded, signUp, signUpLoaded, setActiveSignIn, setActiveSignUp]);
 

  const handleGoogleLogin = useCallback(async () => {
    try {
      setGoogleSubmitting(true);
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (result?.createdSessionId) {
        await result.setActive?.({ session: result.createdSessionId });
        router.replace("/(onboarding)/welcome");
        return;
      }
      throw new Error("Google sign-in did not complete.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Google sign-in failed", reason);
    } finally {
      setGoogleSubmitting(false);
    }
  }, [startSSOFlow]);

  const googleButtonLabel = useMemo(
    () => (googleSubmitting ? "Connecting to Google..." : "Sign in with Google"),
    [googleSubmitting]
  );

  const primaryButtonLabel = mode === "signIn" ? "Continue" : "Create account";
  const headerTitle = mode === "signIn" ? "Sign in to continue" : "Create your account";
  const headerSubtitle =
    mode === "signIn"
      ? "Use your account to save progress and sync across devices."
      : "Quickly set up your profile so you can start saving progress.";
  const footerPrompt =
    mode === "signIn" ? "Don't have an account?" : "Already have an account?";
  const footerActionLabel = mode === "signIn" ? "Sign up" : "Sign in";
  const footerActionMode = mode === "signIn" ? "signUp" : "signIn";

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.subtitle}>{headerSubtitle}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#606060"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#606060"
            secureTextEntry
            textContentType="password"
          />
        </View>

        <Pressable
          onPress={handlePrimaryEmailAction}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !emailSubmitting ? styles.primaryButtonPressed : null,
          ]}
          disabled={emailSubmitting}
        >
          {emailSubmitting ? (
            <ActivityIndicator color="#050505" />
          ) : (
            <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={handleGoogleLogin}
          style={({ pressed }) => [
            styles.googleButton,
            pressed && googleEnabled && !googleSubmitting ? styles.googleButtonPressed : null,
            !googleEnabled ? styles.googleButtonDisabled : null,
          ]}
          disabled={!googleEnabled || googleSubmitting}
        >
          {googleSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.googleButtonText}>{googleButtonLabel}</Text>
          )}
        </Pressable>

        {!googleEnabled && (
          <Text style={styles.helperText}>Google sign-in is temporarily unavailable.</Text>
        )}
      </View>

      <Text style={styles.statusLabel}>
        Status: {status}
        {status === "authenticated" && userEmail ? ` (${userEmail})` : ""}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{footerPrompt}</Text>
        <Pressable onPress={() => setMode(footerActionMode)}>
          <Text style={styles.footerLink}>{footerActionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const LIME = "#B4F34D";
const BG = "#050505";
const CARD_BG = "#0B0B0B";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 64,
    paddingHorizontal: 24,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#1A1A1A",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    width: "25%",
    borderRadius: 999,
    backgroundColor: LIME,
  },
  header: {
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9A9A9A",
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#141414",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#A4A4A4",
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#242424",
    backgroundColor: "#101010",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: LIME,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: "#050505",
    fontWeight: "600",
    fontSize: 16,
  },
  divider: {
    marginVertical: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#242424",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666666",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  googleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  googleButtonPressed: {
    backgroundColor: "#171717",
  },
  googleButtonDisabled: {
    borderColor: "#333333",
    backgroundColor: "#101010",
  },
  googleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  helperText: {
    marginTop: 10,
    color: "#888888",
    fontSize: 13,
    textAlign: "center",
  },
  statusLabel: {
    marginTop: 12,
    color: "#7D7D7D",
    fontSize: 12,
    textAlign: "center",
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#7A7A7A",
    fontSize: 13,
    marginRight: 6,
  },
  footerLink: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
