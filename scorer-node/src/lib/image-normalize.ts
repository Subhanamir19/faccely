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
    return { ext: "heic", mime: "image/heic" };
  }
  return undefined;
}

/**
 * ESM-safe sniff via dynamic import. If unavailable at runtime, fall back to magic bytes.
 */
async function sniffMime(input: Buffer): Promise<{ ext?: string; mime?: string } | undefined> {
  try {
    const mod: any = await import("file-type");
    const res = await mod.fileTypeFromBuffer(input);
    if (res?.mime) return { ext: res.ext, mime: res.mime };
  } catch {
    // ignore, fall back
  }
  return sniffMagic(input);
}

/**
 * Normalize arbitrary user-uploaded bytes into a guaranteed JPEG data URL.
 * - Supports JPEG/PNG/WEBP/GIF/HEIC/HEIF
 * - Auto-rotates
 * - Resizes longest edge to <= maxEdge (default 1024)
 * - Strips metadata, removes alpha
 * - Outputs data:image/jpeg;base64,...
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

  // If HEIC/HEIF, convert to JPEG first (sharp HEIC support is spotty)
  if (kind?.mime === "image/heic" || kind?.mime === "image/heif") {
    const { default: convert } = (await import("heic-convert")) as any;
    const jpegAny = await convert({ buffer: working, format: "JPEG", quality: 0.85 });
    working = Buffer.isBuffer(jpegAny)
      ? jpegAny
      : Buffer.from(
          jpegAny instanceof Uint8Array ? jpegAny : new Uint8Array(jpegAny as ArrayBuffer)
        );
  }

  const maxEdge = opts?.maxEdge ?? 1024;

  let pipeline = sharp(working, { failOn: "none" }).rotate();
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

  const jpeg = await pipeline
    .removeAlpha()
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
    .catch(() => {
      throw new Error("Unsupported or corrupted image. Please upload JPEG/PNG/WEBP/GIF/HEIC.");
    });

  if (!jpeg?.length) {
    throw new Error("Transcode failure: produced empty JPEG buffer.");
  }

  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
