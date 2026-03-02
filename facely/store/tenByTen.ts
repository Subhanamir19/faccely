// facely/store/tenByTen.ts
// Zustand store for the "You as a 10/10" AI face enhancement feature.
// Quota: 2 generations per calendar month per source photo.
//   - Different photo → always allowed (resets same-source counter).
//   - Same photo: 1 original + 1 courtesy retry, then locked until next month.

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

/** "YYYY-MM" string for the current calendar month */
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type TenByTenState = {
  // ── Persisted ────────────────────────────────────────────────────────────
  generatedUri: string | null;   // local file:// URI of saved image
  generatedAt: number | null;    // unix ms

  // Quota tracking — 2 total per calendar month, no exceptions
  monthlyCount: number;          // total generations used this month (0, 1, or 2)
  monthKey: string | null;       // "YYYY-MM" — resets count when month changes

  // ── Transient ─────────────────────────────────────────────────────────────
  loading: boolean;
  error: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  /** Returns true if the user still has generations left this month. */
  canGenerate: () => boolean;
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
    (set, get) => ({
      generatedUri: null,
      generatedAt: null,
      monthlyCount: 0,
      monthKey: null,
      loading: false,
      error: null,

      canGenerate: (): boolean => {
        const { monthlyCount, monthKey } = get();
        const thisMonth = currentMonthKey();
        // New month → count resets
        if (monthKey !== thisMonth) return true;
        return monthlyCount < 2;
      },

      generate: async (imageUri: string, metadata: GenerationMetadata) => {
        const { canGenerate, monthlyCount, monthKey } = get();

        if (!canGenerate()) {
          set({
            error:
              "You've used both generations for this month. " +
              "Come back next month to generate again.",
          });
          return;
        }

        set({ loading: true, error: null });

        try {
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
            timeoutMs: LONG_REQUEST_TIMEOUT_MS,
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

          const thisMonth = currentMonthKey();
          const isNewMonth = monthKey !== thisMonth;
          const newCount = isNewMonth ? 1 : monthlyCount + 1;

          set({
            generatedUri: savedUri,
            generatedAt: Date.now(),
            loading: false,
            monthlyCount: newCount,
            monthKey: thisMonth,
          });
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
        monthlyCount: state.monthlyCount,
        monthKey: state.monthKey,
      }),
    }
  )
);
