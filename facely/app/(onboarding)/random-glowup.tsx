import FeatureStatementScreen from "@/components/onboarding/FeatureStatementScreen";

const RANDOM_GLOWUP = require("../../assets/features-assets/random-glowup.png");

export default function RandomGlowupScreen() {
  return (
    <FeatureStatementScreen
      heading={[
        { text: "random", accent: true },
        { text: " glowup\nadvice is keeping\nyour face the same." },
      ]}
      asset={RANDOM_GLOWUP}
      assetLabel="Random glowup advice objects"
      assetScale={1.56}
      nextRoute="/(onboarding)/sigma-choice"
    />
  );
}
