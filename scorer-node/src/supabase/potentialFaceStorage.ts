// scorer-node/src/supabase/potentialFaceStorage.ts
//
// Dedicated bucket helpers for the Potential Face feature. The bucket
// (`potential-faces`) must exist in Supabase Storage and be private; signed
// URLs are minted per-read with a short TTL so the client can render them.

import { supabase } from "./client.js";

const POTENTIAL_FACE_BUCKET = "potential-faces";

/** Default TTL for signed URLs we hand to the client. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6h — long enough for one app session

export type PotentialFaceVariant = "primary" | "alternate";

export interface UploadPotentialFaceImageParams {
  userId: string;
  stage: number;
  variant: PotentialFaceVariant;
  buffer: Buffer;
  contentType: string;
  /** Cache-busting suffix; defaults to Date.now(). */
  generationId?: string;
}

/**
 * Upload a generated face image. Returns the storage path (NOT a signed URL).
 * Path layout: `{userId}/{stage}/{variant}-{generationId}.jpg`
 */
export async function uploadPotentialFaceImage(
  params: UploadPotentialFaceImageParams
): Promise<string> {
  const { userId, stage, variant, buffer, contentType, generationId } = params;
  const suffix = generationId ?? String(Date.now());
  const key = `${userId}/${stage}/${variant}-${suffix}.jpg`;

  const { error } = await supabase.storage
    .from(POTENTIAL_FACE_BUCKET)
    .upload(key, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`uploadPotentialFaceImage(${variant}) failed: ${error.message}`);
  }
  return key;
}

/**
 * Mint a signed URL for a stored image path. Returns null if the path is null
 * or the underlying call fails (callers should treat missing URLs as soft).
 */
export async function signPotentialFaceImage(
  path: string | null,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(POTENTIAL_FACE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.warn(
      "[potentialFaceStorage] sign failed for path:",
      path,
      error?.message ?? "no_signed_url_in_response"
    );
    return null;
  }
  return data.signedUrl;
}

export async function deleteAllPotentialFacesForUser(userId: string): Promise<void> {
  const prefix = `${userId}/`;
  // Recursive list across stage folders.
  const queue: string[] = [prefix];

  while (queue.length) {
    const dir = queue.shift()!;
    const { data, error } = await supabase.storage
      .from(POTENTIAL_FACE_BUCKET)
      .list(dir, { limit: 100 });

    if (error) {
      throw new Error(`list ${dir} failed: ${error.message}`);
    }
    if (!data?.length) continue;

    const files: string[] = [];
    for (const entry of data) {
      // Folder entries from supabase-js have id === null.
      if ((entry as { id: string | null }).id === null) {
        queue.push(`${dir}${entry.name}/`);
      } else {
        files.push(`${dir}${entry.name}`);
      }
    }
    if (files.length) {
      const { error: rmErr } = await supabase.storage
        .from(POTENTIAL_FACE_BUCKET)
        .remove(files);
      if (rmErr) {
        throw new Error(`remove batch failed: ${rmErr.message}`);
      }
    }
  }
}

export { POTENTIAL_FACE_BUCKET, SIGNED_URL_TTL_SECONDS };
