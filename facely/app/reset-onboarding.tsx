import { useEffect } from "react";
import { View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";

export default function ResetOnboarding() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  useEffect(() => {
    (async () => {
      await AsyncStorage.removeItem("onboarding_done_v1");
      await AsyncStorage.removeItem("onboarding_state_v1");
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Onboarding reset. Restart the app.</Text>
    </View>
  );
}
