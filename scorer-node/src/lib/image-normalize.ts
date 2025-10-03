// src/lib/image-normalize.ts
import sharp from "sharp";

/** Lightweight magic-byte sniff for common formats */
function sniffMagic(buf: Buffer): { ext: string; mime: string } | undefined {
  if (buf.length < 12) return undefined;

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // PNG
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png" };
  }
  // WEBP
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  // GIF
  const sig = buf.slice(0, 6).toString("ascii");
  if (sig === "GIF87a" || sig === "GIF89a") {
    return { ext: "gif", mime: "image/gif" };
  }
  // HEIF family (brands start at offset 4)
  if (buf.slice(4, 8).toString("ascii") === "ftyp") {
    // We don’t check exact brand; treat as HEIC/HEIF-ish and let decode decide.
    return { ext: "heic", mime: "image/heic" };
  }
  return undefined;
}

/**
 * ESM-safe sniff via dynamic import. If unavailable at runtime, we’ll fall back to magic bytes.
 */
async function sniffMime(input: Buffer): Promise<{ ext?: string; mime?: string } | undefined> {
  try {
    const mod: any = await import("file-type");
    const res = await mod.fileTypeFromBuffer(input);
    if (res?.mime) return { ext: res.ext, mime: res.mime };
  } catch {
    // ignore, fall back to magic sniff
  }
  return sniffMagic(input);
}

/**
 * Normalize arbitrary user-uploaded bytes into a guaranteed PNG data URL.
 * Accepts JPEG/PNG/WEBP/GIF/HEIC/HEIF if your environment supports them.
 * - Don’t trust client MIME: sniff bytes
 * - Auto-rotate from EXIF
 * - Resize longest edge to <= maxEdge (default 2048)
 * - Strip metadata
 * - Output data:image/png;base64,...
 */
export async function normalizeToPngDataUrl(
  input: Buffer,
  opts?: { maxEdge?: number }
): Promise<string> {
  if (!input || input.length === 0) {
    throw new Error("Empty buffer: no image data received.");
  }

  const kind = await sniffMime(input);
  let working = input;

  // If HEIC/HEIF, always convert to JPEG first (Windows sharp often lacks HEIF)
if (kind?.mime === "image/heic" || kind?.mime === "image/heif") {
  const { default: convert } = (await import("heic-convert")) as any;
  const jpegAny = await convert({ buffer: working, format: "JPEG", quality: 0.92 });
  // heic-convert may return Uint8Array | ArrayBuffer | Buffer
  const jpegBuf =
    Buffer.isBuffer(jpegAny)
      ? jpegAny
      : Buffer.from(jpegAny instanceof Uint8Array ? jpegAny : new Uint8Array(jpegAny as ArrayBuffer));
  working = jpegBuf;
}


  const maxEdge = opts?.maxEdge ?? 2048;

  // Try decoding. failOn:'none' prevents hard crash on minor bit-rot; we handle empty meta below.
  let pipeline = sharp(working, { failOn: "none", unlimited: false }).rotate();

  const meta = await pipeline.metadata().catch(() => ({} as sharp.Metadata));
  if (!meta.width || !meta.height) {
    throw new Error(`Unsupported or corrupted image (${kind?.mime ?? "unknown"}). Please upload JPEG/PNG/WEBP/GIF/HEIC.`);

  }

  const longer = Math.max(meta.width, meta.height);
  if (longer > maxEdge) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? maxEdge : undefined,
      height: meta.height > meta.width ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const png = await pipeline
    .removeAlpha() // keep it simple for downstream
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
    .catch(() => {
      throw new Error("Unsupported or corrupted image. Please upload JPEG/PNG/WEBP/GIF/HEIC.");
    });

  if (!png?.length) {
    throw new Error("Transcode failure: produced empty PNG buffer.");
  }

  return `data:image/png;base64,${png.toString("base64")}`;
}
