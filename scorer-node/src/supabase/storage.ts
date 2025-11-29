import { supabase } from "./client.js";

export type ScanImageVariant = "front" | "side";

export interface UploadScanImageParams {
  userId: string;
  variant: ScanImageVariant;
  buffer: Buffer;
  contentType: string;
  requestId?: string;
}

const SCAN_BUCKET = "face-scans";

export async function uploadScanImage(params: UploadScanImageParams): Promise<string> {
  const { userId, variant, buffer, contentType, requestId } = params;
  const suffix = requestId ? `-${requestId}` : "";
  const key = `${userId}/${Date.now()}-${variant}${suffix}.jpg`;

  const { error } = await supabase.storage.from(SCAN_BUCKET).upload(key, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload scan image (${variant}): ${error.message}`);
  }

  return key;
}

export async function signScanImage(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SCAN_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign scan image URL`);
  }

  return data.signedUrl;
}

export async function deleteAllFaceScansForUser(userId: string): Promise<void> {
  const prefix = `${userId}/`;
  let page = 0;
  const pageSize = 100;
  while (true) {
    const { data, error } = await supabase.storage
      .from(SCAN_BUCKET)
      .list(prefix, { limit: pageSize, offset: page * pageSize });

    if (error) {
      throw new Error(`Failed to list scan images for user: ${error.message}`);
    }

    const files = data ?? [];
    if (files.length === 0) {
      return;
    }

    const keys = files.map((f) => `${prefix}${f.name}`);
    const { error: removeError } = await supabase.storage.from(SCAN_BUCKET).remove(keys);
    if (removeError) {
      throw new Error(`Failed to delete scan images for user: ${removeError.message}`);
    }

    if (files.length < pageSize) {
      return;
    }
    page += 1;
  }
}
