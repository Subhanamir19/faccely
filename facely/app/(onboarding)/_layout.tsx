import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "fade" }}
      initialRouteName="splash"
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="pain-points" />
      <Stack.Screen name="transformation" />
      <Stack.Screen name="gender" />
      <Stack.Screen name="age" />
      <Stack.Screen name="ethnicity" />
      <Stack.Screen name="camera-priming" />
      <Stack.Screen name="face-scan" />
      <Stack.Screen name="trust" />
      <Stack.Screen name="improve-areas" />
      <Stack.Screen name="time-dedication" />
      <Stack.Screen name="routine-animation" />
      <Stack.Screen name="routine-preview" />
      <Stack.Screen name="score-projection" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="score-teaser" />
    </Stack>
  );
}
