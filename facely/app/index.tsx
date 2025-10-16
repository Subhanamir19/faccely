// app/index.tsx
import { Redirect } from "expo-router";

export default function IndexGate() {
  return <Redirect href="/(onboarding)/welcome" />;

}
