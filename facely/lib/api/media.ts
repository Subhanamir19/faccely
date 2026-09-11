// facely/lib/api/media.ts
// Shared helpers for resolving upload paths and normalizing images.

import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";

export type UploadInput = string | { uri: string; name?: string; mime?: string };

export class UploadNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadNormalizationError";
  }
}

async function tryGetInfo(path: string) {
  try {
    return await FileSystem.getInfoAsync(path);
  } catch {
    return null;
  }
}

export async function resolveExistingPath(uri: string): Promise<string> {
  if (!uri) {
    throw new UploadNormalizationError(
      "Selected image is no longer available on disk. Re-select the photo and try again."
    );
  }

  const initialInfo = await tryGetInfo(uri);
  if (initialInfo?.exists) {
    return uri;
  }

  const candidates = [uri];

  try {
    const u = new URL(uri);
    const path = u.pathname || "";
    const enc = `file://${encodeURI(path)}`;
    const dec = `file://${decodeURI(path)}`;
    for (const candidate of [enc, dec]) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  } catch {
    const enc = encodeURI(uri);
    const dec = decodeURI(uri);
    if (!candidates.includes(enc)) candidates.push(enc);
    if (!candidates.includes(dec)) candidates.push(dec);
  }

  for (const cand of candidates) {
    const info = await tryGetInfo(cand);
    if (info?.exists) return cand;
  }

  if (!uri.startsWith("file://")) {
    const dest = `${FileSystem.cacheDirectory ?? ""}upload-${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      const copiedInfo = await tryGetInfo(dest);
      if (copiedInfo?.exists) return dest;
    } catch {
      // ignore; we'll throw below
    }
  }

  throw new UploadNormalizationError(
    "Selected image is no longer available on disk. Re-select the photo and try again."
  );
}

/**
 * Resolve an upload URI to an Expo File. SDK 57's native fetch serializer
 * requires a Blob-compatible part with bytes(); legacy { uri, name, type }
 * FormData values are not supported.
 */
export async function prepareUploadPart(input: UploadInput): Promise<File> {
  const uri = typeof input === "string" ? input : input.uri;
  if (!uri || uri.trim().length === 0) {
    throw new UploadNormalizationError("Image path is empty. Please select the photo again.");
  }

  const path = await resolveExistingPath(uri);
  return new File(path);
}

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
