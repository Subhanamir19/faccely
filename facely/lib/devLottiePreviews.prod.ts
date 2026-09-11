// lib/devLottiePreviews.prod.ts
// Production stand-in for devLottiePreviews.ts, substituted by
// metro.config.js when NODE_ENV=production. Keeps ~11 MB of embedded Lottie
// JSON out of release bundles. The dev screen that reads this is unreachable
// in release builds, so an empty map is never rendered.
export const LOTTIE_PREVIEWS: Record<
  string,
  { title: string; detail: string; source: unknown }
> = {};

export type LottiePreviewId = string;
