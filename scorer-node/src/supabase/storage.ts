import { supabase } from "./client.js";

export type ScanImageVariant = "front" | "side";

export interface UploadScanImageParams {
  userId: string;
  variant: ScanImageVariant;
  buffer: Buffer;
  contentType: string;
  requestId?: string;
}

export async function uploadScanImage(params: UploadScanImageParams): Promise<string> {
  const { userId, variant, buffer, contentType, requestId } = params;
  const suffix = requestId ? `-${requestId}` : "";
  const key = `${userId}/${Date.now()}-${variant}${suffix}.jpg`;

  const { error } = await supabase
    .storage
    .from("face-scans")
    .upload(key, buffer, { contentType, upsert: false });

  if (error) {
    throw new Error(`Failed to upload scan image (${variant}): ${error.message}`);
  }

  return key;
}
