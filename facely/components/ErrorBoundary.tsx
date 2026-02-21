/**
 * components/ErrorBoundary.tsx
 *
 * React class-based Error Boundary.
 * Catches any unhandled render/lifecycle errors in the subtree,
 * shows a recoverable fallback UI, and logs the error.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 *   // Or with a custom fallback:
 *   <ErrorBoundary fallback={<MyFallback />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { logger } from "@/lib/logger";

type Props = {
  children: React.ReactNode;
  /** Optional custom fallback. If omitted, the default fallback UI is shown. */
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    logger.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
    // Future: Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an unexpected error. Tap below to try again.
          </Text>
          {__DEV__ && this.state.errorMessage ? (
            <Text style={styles.devError}>{this.state.errorMessage}</Text>
          ) : null}
          <View style={styles.baseOuter}>
            <Pressable
              onPress={this.handleReset}
              style={({ pressed }) => [
                styles.button,
                { transform: [{ translateY: pressed ? 4 : 0 }] },
              ]}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return <>{this.props.children}</>;
  }
}

const ACCENT = "#B4F34D";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0B",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
  },
  devError: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "monospace",
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    alignSelf: "stretch",
    textAlign: "left",
  },
  // 3D chunky button — consistent with app-wide style
  baseOuter: {
    borderRadius: 28,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  button: {
    height: 56,
    paddingHorizontal: 48,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#0B0B0B",
    fontSize: 18,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
});
