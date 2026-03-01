// facely/store/tenByTen.ts
// Zustand store for the "You as a 10/10" AI face enhancement feature.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { API_BASE } from "@/lib/api/config";
import { buildAuthHeadersAsync } from "@/lib/api/authHeaders";
import { fetchWithRetry, LONG_REQUEST_TIMEOUT_MS } from "@/lib/api/client";

export type GenerationMetadata = {
  gender?: string | null;
  ethnicity?: string | null;
  age?: number | null;
};

type TenByTenState = {
  // Persisted
  generatedUri: string | null;   // local file:// URI of the saved image
  generatedAt: number | null;    // unix timestamp ms

  // Transient
  loading: boolean;
  error: string | null;

  // Actions
  generate: (imageUri: string, metadata: GenerationMetadata) => Promise<void>;
  clear: () => void;
};

const IMAGES_DIR = `${FileSystem.documentDirectory}ten-by-ten/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

async function saveImageFromB64(b64: string): Promise<string> {
  await ensureDir();
  const filename = `ten-by-ten-${Date.now()}.jpg`;
  const dest = `${IMAGES_DIR}${filename}`;
  await FileSystem.writeAsStringAsync(dest, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dest;
}

export const useTenByTen = create<TenByTenState>()(
  persist(
    (set) => ({
      generatedUri: null,
      generatedAt: null,
      loading: false,
      error: null,

      generate: async (imageUri: string, metadata: GenerationMetadata) => {
        set({ loading: true, error: null });

        try {
          // Build multipart form — same pattern as /analyze
          const form = new FormData();
          form.append("image", {
            uri: imageUri,
            name: "face.jpg",
            type: "image/jpeg",
          } as any);
          if (metadata.gender) form.append("gender", metadata.gender);
          if (metadata.ethnicity) form.append("ethnicity", metadata.ethnicity);
          if (metadata.age != null) form.append("age", String(metadata.age));

          const url = `${API_BASE}/generate/ten-by-ten`;
          const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });

          const res = await fetchWithRetry(url, {
            method: "POST",
            body: form,
            headers: { Accept: "application/json", ...authHeaders },
            timeoutMs: LONG_REQUEST_TIMEOUT_MS, // 3 min — gpt-image-1 can be slow
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              (body as any).message || `Generation failed: HTTP ${res.status}`
            );
          }

          const data = await res.json();
          if (!data?.b64) throw new Error("No image returned from server");

          const savedUri = await saveImageFromB64(data.b64);
          set({ generatedUri: savedUri, generatedAt: Date.now(), loading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Generation failed. Please try again.";
          set({ loading: false, error: message });
        }
      },

      clear: () => set({ generatedUri: null, generatedAt: null, error: null }),
    }),
    {
      name: "sigma_ten_by_ten_v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        generatedUri: state.generatedUri,
        generatedAt: state.generatedAt,
      }),
    }
  )
);
