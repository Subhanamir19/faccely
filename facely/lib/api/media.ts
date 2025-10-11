// facely/lib/api/media.ts
// Single source of truth for pre-upload normalization.
// Forces any image (HEIC/PNG/JPEG/whatever) to a ~1–2MB JPEG.

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

/**
 * Convert/resize/compress before upload.
 * - Resize to max width 1080 (keeps aspect)
 * - JPEG quality ~0.8
 * - Ensures a .jpg filename (Android FormData cares)
 */
export async function ensureJpegCompressed(
  uri: string,
  opts: { maxWidth?: number; compress?: number } = {}
): Promise<{ uri: string; sizeBytes: number; mime: "image/jpeg"; name: string }> {
  const maxWidth = opts.maxWidth ?? 1080;
  const compress = opts.compress ?? 0.8;

  // 1) Manipulate into JPEG
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2) Guarantee .jpg extension for Android's FormData
  let outUri = result.uri;
  if (!/\.jpe?g($|\?|#)/i.test(outUri)) {
    const dest = `${FileSystem.cacheDirectory}norm-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: outUri, to: dest });
    outUri = dest;
  }

  // 3) Size for logs/debug
  let sizeBytes = 0;
  try {
    const info = await FileSystem.getInfoAsync(outUri);
    sizeBytes = (info as any)?.size ?? 0;
  } catch {
    // ignore
  }

  return {
    uri: outUri,
    sizeBytes,
    mime: "image/jpeg",
    name: `photo-${Date.now()}.jpg`,
  };
}
