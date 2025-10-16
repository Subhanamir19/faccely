import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
<Stack
      screenOptions={{ headerShown: false, animation: "fade" }}
      initialRouteName="welcome"
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="age" />
      <Stack.Screen name="ethnicity" />
      <Stack.Screen name="gender" />
      <Stack.Screen name="edge" />
      <Stack.Screen name="trust" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
