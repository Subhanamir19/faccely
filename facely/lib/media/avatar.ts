// lib/media/avatar.ts
// Normalize, compress, and persist profile avatar images to a stable directory.
import * as FileSystem from "expo-file-system";

import { ensureJpegCompressed, resolveExistingPath } from "@/lib/api/media";

function toFileUri(u: string) {
  if (u.startsWith("file://") || u.startsWith("http")) return u;
  if (u.startsWith("/")) return `file://${u}`;
  return u;
}

async function normalizeAvatarUri(raw: string): Promise<string> {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new Error("Avatar path is empty.");
  }

  const candidate =
    trimmed.startsWith("file://") || trimmed.startsWith("content://")
      ? trimmed
      : toFileUri(trimmed);

  try {
    return await resolveExistingPath(candidate);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err || "");
    throw new Error(reason || "Avatar image could not be read from disk.");
  }
}

async function ensureProfileImageDir(): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error("Persistent storage unavailable");
  }
  const dir = `${base.replace(/\/?$/, "/")}images/profile/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function persistAvatarFromUri(inputUri: string): Promise<string> {
  const readable = await normalizeAvatarUri(inputUri);
  const compressed = await ensureJpegCompressed(readable);

  const dir = await ensureProfileImageDir();
  const filename = `avatar-${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
  const dest = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: compressed.uri, to: dest });
  return dest;
}
