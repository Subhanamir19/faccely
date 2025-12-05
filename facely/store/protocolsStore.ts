import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  generateProtocolsFromPayload,
  generateProtocolsFromScan,
  type ProtocolBucketKey,
  type ProtocolsResponse,
} from "@/lib/api/protocols";
import { fetchScanHistory } from "@/lib/api/history";
import { useScores } from "./scores";

type SourceKind = "history" | "session" | null;

type ProtocolsState = {
  protocols: Record<ProtocolBucketKey, string> | null;
  sourceScanId: string | null;
  sourceKind: SourceKind;
  updatedAt: string | null;

  isLoading: boolean;
  error: string | null;

  setFromResponse: (
    res: ProtocolsResponse,
    meta: { sourceScanId: string | null; sourceKind: Exclude<SourceKind, null> }
  ) => void;
  clear: () => void;

  regenerateFromScanId: (scanId: string) => Promise<void>;
  regenerateFromLastAnalysis: () => Promise<void>;
};

const STORAGE_KEY = "sigma_protocols_v1";

function toMessage(err: unknown): string {
  if (err instanceof Error && typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }
  if (typeof err === "string" && err.trim()) return err;
  return "Failed to regenerate protocols";
}

const initialState: ProtocolsState = {
  protocols: null,
  sourceScanId: null,
  sourceKind: null,
  updatedAt: null,
  isLoading: false,
  error: null,
  setFromResponse: () => {},
  clear: () => {},
  regenerateFromScanId: async () => {},
  regenerateFromLastAnalysis: async () => {},
};

export const useProtocolsStore = create<ProtocolsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setFromResponse: (res, meta) =>
        set({
          protocols: res.protocols,
          sourceScanId: meta.sourceScanId,
          sourceKind: meta.sourceKind,
          updatedAt: res.createdAt,
          error: null,
        }),

      clear: () =>
        set({
          protocols: null,
          sourceScanId: null,
          sourceKind: null,
          updatedAt: null,
          error: null,
          isLoading: false,
        }),

      regenerateFromScanId: async (scanId: string) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const res = await generateProtocolsFromScan(scanId);
          get().setFromResponse(res, { sourceScanId: scanId, sourceKind: "history" });
        } catch (err) {
          set({ error: toMessage(err) });
        } finally {
          set({ isLoading: false });
        }
      },

      regenerateFromLastAnalysis: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        try {
          const { protocols, sourceScanId } = get();
          const history = await fetchScanHistory(1);
          const latest = Array.isArray(history) ? history[0] : null;

          let currentScanId: string | null = null;

          if (latest?.id) {
            currentScanId = latest.id;
          } else {
            const { scanId } = useScores.getState();
            currentScanId = scanId ?? null;
          }

          if (protocols && sourceScanId === currentScanId) {
            return;
          }

          if (latest?.id) {
            const res = await generateProtocolsFromScan(latest.id);
            get().setFromResponse(res, { sourceScanId: latest.id, sourceKind: "history" });
            return;
          }

          const { scores, explanations, scanId } = useScores.getState();
          if (!scores) {
            throw new Error("no_analysis_available");
          }

          const res = await generateProtocolsFromPayload(scores, explanations ?? null);
          get().setFromResponse(res, {
            sourceScanId: scanId ?? null,
            sourceKind: "session",
          });
        } catch (err) {
          set({ error: toMessage(err) });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        protocols: state.protocols,
        sourceScanId: state.sourceScanId,
        sourceKind: state.sourceKind,
        updatedAt: state.updatedAt,
      }),
    }
  )
);
