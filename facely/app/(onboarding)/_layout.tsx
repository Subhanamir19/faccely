import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="age" />
      <Stack.Screen name="ethnicity" />
      <Stack.Screen name="gender" />
      {/* 👇 new final onboarding screen */}
      <Stack.Screen name="edge" />
    </Stack>
  );
}
