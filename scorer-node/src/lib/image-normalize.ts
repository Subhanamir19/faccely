// src/lib/image-normalize.ts
import sharp from "sharp";

/**
 * ESM-safe mime sniff. `file-type` is ESM-only, so we import it dynamically
 * from CommonJS/ts-node-dev. If it fails, we just return null and let sharp try.
 */
async function sniffMime(input: Buffer): Promise<string | null> {
  try {
    // dynamic import avoids ERR_REQUIRE_ESM under CJS
    const mod = await import("file-type");
    const res = await mod.fileTypeFromBuffer(input);
    return res?.mime ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalize arbitrary user-uploaded bytes into a guaranteed PNG data URL.
 * Accepts JPEG/PNG/WEBP/GIF/HEIC/TIFF/BMP if your sharp/libvips supports it.
 * - Optionally sniffs actual type (don’t trust client MIME)
 * - Decodes the image or throws a clean error if it’s not an image
 * - Resizes down to a sane max edge (default 2048)
 * - Strips metadata
 * - Returns: "data:image/png;base64,...."
 */
export async function normalizeToPngDataUrl(
  input: Buffer,
  opts?: {
    maxEdge?: number; // default 2048
  }
): Promise<string> {
  if (!input || input.length === 0) {
    throw new Error("Empty buffer: no image data received.");
  }

  // Best-effort sniff (doesn't crash under CJS)
  await sniffMime(input); // result not currently used, but call keeps parity if you want to log it later

  const maxEdge = opts?.maxEdge ?? 2048;

  // Let sharp try decoding whatever it can. failOn:'none' avoids hard crashes on minor issues.
  let img = sharp(input, { failOn: "none", unlimited: false });

  const meta = await img.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Unreadable image: width/height missing after decode.");
  }

  // Cap the longest side for sanity. 2K is plenty for face analysis.
  const longer = Math.max(meta.width, meta.height);
  if (longer > maxEdge) {
    img = img.resize({
      width: meta.width >= meta.height ? maxEdge : undefined,
      height: meta.height > meta.width ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true
    });
  }

  // Flatten odd formats and remove metadata. Transcode to PNG (universally supported).
  const png = await img
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()
    .catch(() => {
      // Sharp couldn’t decode. This is the real “not an image” case.
      throw new Error(
        "Unsupported or corrupted image. Please upload JPEG/PNG/WEBP/GIF/HEIC."
      );
    });

  if (!png || png.length === 0) {
    throw new Error("Transcode failure: produced empty PNG buffer.");
  }

  const b64 = png.toString("base64");
  return `data:image/png;base64,${b64}`;
}
