import FeatureStatementScreen from "@/components/onboarding/FeatureStatementScreen";

const SIGMAMAX_CHOICE = require("../../assets/features-assets/sigmamax-choice.png");

export default function SigmaChoiceScreen() {
  return (
    <FeatureStatementScreen
      heading={[
        { text: "SigmaMax", accent: true },
        { text: " gives\nthe plan your face\nactually needs." },
      ]}
      asset={SIGMAMAX_CHOICE}
      assetLabel="SigmaMax routine plan phone preview"
      assetScale={1.43}
      nextRoute="/(onboarding)/feature-sequence"
    />
  );
}
