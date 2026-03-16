import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "fade" }}
      initialRouteName="splash"
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="transformation" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="use-case" />
      <Stack.Screen name="gender" />
      <Stack.Screen name="age" />
      <Stack.Screen name="ethnicity" />
      <Stack.Screen name="edge" />
      <Stack.Screen name="face-scan" />
      <Stack.Screen name="trust" />
      <Stack.Screen name="score-teaser" />
      <Stack.Screen name="improve-areas" />
      <Stack.Screen name="time-dedication" />
      <Stack.Screen name="routine-animation" />
      {/* results-reveal hidden for v1 — will be polished for next version */}
      {/* <Stack.Screen name="results-reveal" /> */}
      <Stack.Screen name="score-projection" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
