import { Stack } from "expo-router";

// Screen files in this directory are auto-discovered by Expo Router.
// `screenOptions` below applies to every child route, so individual
// `<Stack.Screen />` entries are only needed when overriding per-screen options.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
      initialRouteName="splash"
    />
  );
}
