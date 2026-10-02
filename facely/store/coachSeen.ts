import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { useScores } from "./scores";

/* ============================================================================
 * Which scan Coach has "talked about".
 *
 * A new scan badges the Coach tab until the user opens it, so Coach can pull
 * them back with something to say about the result instead of waiting to be
 * asked. Tracked on the device by scan id; nothing goes to the server.
 * ========================================================================== */

type State = {
  seenScanId: string | null;
  markScanSeen: (scanId: string) => void;
};

export const useCoachSeen = create<State>()(
  persist(
    (set) => ({
      seenScanId: null,
      markScanSeen: (scanId) => set({ seenScanId: scanId }),
    }),
    {
      name: "facely.coach.seen",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ seenScanId: state.seenScanId }),
    }
  )
);

/** True while the latest scan has not been opened in Coach yet. */
export function useHasUnseenCoachScan(): boolean {
  const scanId = useScores((state) => state.scanId);
  const seenScanId = useCoachSeen((state) => state.seenScanId);
  return scanId !== null && scanId !== seenScanId;
}
