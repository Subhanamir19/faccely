// facely/lib/api/media.ts
// Single source of truth for pre-upload normalization.
// Forces any image (HEIC/PNG/JPEG/whatever) to a ~1–2MB JPEG.

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

export type UploadInput = string | { uri: string; name?: string; mime?: string };

const JPEG_MIME = "image/jpeg";

export class UploadNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadNormalizationError";
  }
}

function ensureJpegName(name: string) {
  return /\.jpe?g$/i.test(name) ? name : `${name.replace(/\.[^./\\]+$/, "")}.jpg`;
}

function toFileMeta(input: UploadInput, fallbackName: string) {
  if (typeof input === "string") {
    return { uri: input, name: fallbackName, mime: JPEG_MIME };
  }
  const name = input.name && input.name.trim().length > 0 ? input.name : fallbackName;
  const mime = input.mime && input.mime.trim().length > 0 ? input.mime : JPEG_MIME;
  return { uri: input.uri, name, mime };
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

export async function prepareUploadPart(
  input: UploadInput,
  fallbackName: string
): Promise<{ uri: string; name: string; type: string }> {
  const meta = toFileMeta(input, fallbackName);
  if (!meta.uri || meta.uri.trim().length === 0) {
    throw new UploadNormalizationError("Image path is empty. Please select the photo again.");
  }

  const path = await resolveExistingPath(meta.uri);
  return {
    uri: path,
    name: ensureJpegName(meta.name),
    type: meta.mime || JPEG_MIME,
  };
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
