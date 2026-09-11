// lib/devLottiePreviews.ts
// Lottie sources for the dev-only exercise preview screen.
//
// These `.embedded.json` files carry their images base64-inlined, so they are
// ~11 MB in total and land inside the JS bundle rather than the asset store.
// It must live outside app/ : expo-router require.context()s that whole tree,
// which would bundle this file even when nothing imports it.
// The dev screen is unreachable in release builds (`href: null`), so
// metro.config.js swaps this module for devLottiePreviews.prod.ts when
// NODE_ENV=production and none of it ships. Keep every require static here:
// the swap is what removes them, not conditional code.
/* eslint-disable @typescript-eslint/no-var-requires */

export const LOTTIE_PREVIEWS = {
  neck1: {
    title: "neck1.lottie",
    detail: "neck1.embedded.json",
    source: require("../assets/new-exercises-images/neck1.embedded.json"),
  },
  nose1: {
    title: "nose1-slimnose.lottie",
    detail: "nose1-slimnose.embedded.json",
    source: require("../assets/new-exercises-images/nose1-slimnose.embedded.json"),
  },
  noseSlim2: {
    title: "Slim Nose 2",
    detail: "nose-slim2.embedded.json",
    source: require("../assets/new-exercises-images/nose-slim2.embedded.json"),
  },
  slimNose3: {
    title: "Slim Nose 3",
    detail: "slim-nose3.embedded.json",
    source: require("../assets/new-exercises-images/slim-nose3.embedded.json"),
  },
  chinTucksBasic: {
    title: "chin-tucks-basic.lottie",
    detail: "chin-tucks-basic.embedded.json",
    source: require("../assets/new-exercises-images/chin-tucks-basic.embedded.json"),
  },
  neck2: {
    title: "neck2.lottie",
    detail: "neck2.embedded.json",
    source: require("../assets/new-exercises-images/neck2.embedded.json"),
  },
  neck3: {
    title: "neck3.lottie",
    detail: "neck3.embedded.json",
    source: require("../assets/new-exercises-images/neck3.embedded.json"),
  },
  eyeArea1: {
    title: "eye-area1.lottie",
    detail: "eye-area1.embedded.json",
    source: require("../assets/new-exercises-images/eye-area1.embedded.json"),
  },
  eyeBrowsLifting: {
    title: "Eye Brow Lifting",
    detail: "eye-brows-lifting.embedded.json",
    source: require("../assets/new-exercises-images/eye-brows-lifting.embedded.json"),
  },
  jawForcing: {
    title: "jaw-forcing.lottie",
    detail: "jaw-forcing.embedded.json",
    source: require("../assets/new-exercises-images/jaw-forcing.embedded.json"),
  },
  tongueTouching1: {
    title: "tongue-touching-1.lottie",
    detail: "tongue-touching-1.embedded.json",
    source: require("../assets/new-exercises-images/tongue-touching-1.embedded.json"),
  },
  chinTraining: {
    title: "Chin Ball Press",
    detail: "chin-ball-pressing.embedded.json",
    source: require("../assets/new-exercises-images/chin-ball-pressing.embedded.json"),
  },
  cheekPuffs: {
    title: "cheek-puffs",
    detail: "cheek-puffs.embedded.json",
    source: require("../assets/new-exercises-images/cheek-puffs.embedded.json"),
  },
  chinStretch: {
    title: "chin-stretch",
    detail: "chin-stretch.embedded.json",
    source: require("../assets/new-exercises-images/chin-stretch.embedded.json"),
  },
  upwardChinStretch: {
    title: "Upward Chin Stretch",
    detail: "upward-chin-stretch.embedded.json",
    source: require("../assets/new-exercises-images/upward-chin-stretch.embedded.json"),
  },
  chinBallPressing: {
    title: "Chin Ball Pressing",
    detail: "chin-ball-pressing.embedded.json",
    source: require("../assets/new-exercises-images/chin-ball-pressing.embedded.json"),
  },
  midfaceLift: {
    title: "midface-lift",
    detail: "midface-lift.embedded.json",
    source: require("../assets/new-exercises-images/midface-lift.embedded.json"),
  },
} as const;
export type LottiePreviewId = keyof typeof LOTTIE_PREVIEWS;
