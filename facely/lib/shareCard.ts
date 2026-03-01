// lib/shareCard.ts
// Captures a React Native view as a PNG and opens the native share sheet.

import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import type { RefObject } from "react";

export async function captureAndShare(ref: RefObject<any>): Promise<void> {
  const uri = await captureRef(ref, {
    format: "png",
    quality: 1.0,
    result: "tmpfile",
  });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Share your Sigma Score",
    UTI: "public.png",
  });
}
