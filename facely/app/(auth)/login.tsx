// facely/app/(auth)/login.tsx
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSSO } from "@clerk/clerk-expo";
import Screen from "@/components/layout/Screen";
import { COLORS, SP } from "@/lib/tokens";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
  const status = useAuthStore((state) => state.status);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);
  const { startSSOFlow } = useSSO();

  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const googleEnabled = true;

  const handleGoogleLogin = useCallback(async () => {
    const redirectUrl = "sigmamax://oauth-callback";

    try {
      setGoogleSubmitting(true);
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
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

  if (status === "authenticated") {
    router.replace("/(onboarding)/welcome");
    return null;
  }

  return (
    <Screen scroll keyboardAware contentContainerStyle={styles.content}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Sign in to continue</Text>
        <Text style={styles.subtitle}>
          Use your Google account to save progress and sync across devices.
        </Text>
      </View>

      <View style={styles.card}>
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
            <ActivityIndicator color={COLORS.text} />
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
  googleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.text,
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
    color: COLORS.text,
    fontSize: 16,
  },
  helperText: {
    marginTop: 10,
    color: "#888888",
    fontSize: 13,
    textAlign: "center",
  },
  statusLabel: {
    marginTop: SP[3],
    color: COLORS.sub,
    fontSize: 12,
    textAlign: "center",
  },
});
