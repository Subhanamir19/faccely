// facely/app/(auth)/login.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_SCOPES: string[] = ["openid", "profile", "email"];

const generateRandomString = () =>
  Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");

export default function LoginScreen() {
  const loginWithEmail = useAuthStore((state) => state.loginWithEmail);
  const loginWithGoogleIdToken = useAuthStore((state) => state.loginWithGoogleIdToken);
  const status = useAuthStore((state) => state.status);
  const initialized = useAuthStore((state) => state.initialized);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const googleEnabled = Boolean(googleClientId);
  const redirectUri = useMemo(() => AuthSession.makeRedirectUri(), []);
  const nonce = useMemo(() => generateRandomString(), []);
  const stateParam = useMemo(() => generateRandomString(), []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId ?? "",
      responseType: "id_token",
      scopes: GOOGLE_SCOPES,
      redirectUri,
      state: stateParam,
      extraParams: {
        nonce,
      },
    },
    {
      authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
    }
  );

  const handleEmailLogin = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      Alert.alert("Missing info", "Enter both email and password to continue.");
      return;
    }

    setEmailSubmitting(true);
    try {
      await loginWithEmail(trimmedEmail, password);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Sign in failed", reason);
    } finally {
      setEmailSubmitting(false);
    }
  }, [email, password, loginWithEmail]);

  const handleGoogleLogin = useCallback(async () => {
    if (!googleClientId) {
      Alert.alert(
        "Unavailable",
        "Google sign-in is not configured. Please use email/password for now."
      );
      return;
    }

    try {
      setGoogleSubmitting(true);
      if (!request) {
        Alert.alert("Please wait", "Google sign-in is still initializing.");
        setGoogleSubmitting(false);
        return;
      }

      await promptAsync();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Google sign-in failed", reason);
      setGoogleSubmitting(false);
    }
  }, [googleClientId, promptAsync, request]);

  useEffect(() => {
    if (!initialized || status === "checking") {
      return;
    }

    if (status === "authenticated") {
      router.replace("/");
    }
  }, [initialized, status, onboardingCompleted]);

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === "success") {
      const idToken = response.params?.id_token as string | undefined;
      if (!idToken) {
        Alert.alert("Google sign-in failed", "Missing ID token in the Google response.");
        setGoogleSubmitting(false);
        return;
      }

      const applyLogin = async () => {
        try {
          await loginWithGoogleIdToken(idToken);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          Alert.alert("Google sign-in failed", reason);
        } finally {
          setGoogleSubmitting(false);
        }
      };

      void applyLogin();
      return;
    }

    if (response.type === "cancel" || response.type === "dismiss") {
      setGoogleSubmitting(false);
      return;
    }

    if (response.type === "error") {
      const errorMessage =
        response.error?.message ||
        (response.params?.error_description as string | undefined) ||
        "Unable to complete Google sign-in.";
      Alert.alert("Google sign-in failed", errorMessage);
      setGoogleSubmitting(false);
      return;
    }

    setGoogleSubmitting(false);
  }, [response, loginWithGoogleIdToken]);

  const googleButtonLabel = useMemo(() => {
    if (!googleEnabled) {
      return "Google sign-in unavailable";
    }
    return googleSubmitting ? "Connecting to Google..." : "Sign in with Google";
  }, [googleEnabled, googleSubmitting]);

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Sign in to continue</Text>
        <Text style={styles.subtitle}>
          Use your account to save progress and sync across devices.
        </Text>
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
          onPress={handleEmailLogin}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !emailSubmitting ? styles.primaryButtonPressed : null,
          ]}
          disabled={emailSubmitting}
        >
          {emailSubmitting ? (
            <ActivityIndicator color="#050505" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account?</Text>
        <Pressable
          onPress={() =>
            Alert.alert("Sign up", "Sign up flow is not implemented yet, only login for now.")
          }
        >
          <Text style={styles.footerLink}>Sign up</Text>
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
