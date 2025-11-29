// store/profile.ts
// Profile avatar state with manual hydration/persistence via AsyncStorage.
import { create } from "zustand";

import { getJSON, setJSON } from "@/lib/storage";

type PersistedAvatar = {
  avatarUri: string | null;
  lastUpdated: string | null;
};

type ProfileState = PersistedAvatar & {
  hydrate: () => Promise<void>;
  setAvatar: (uri: string) => Promise<void>;
  clearAvatar: () => Promise<void>;
};

const STORAGE_KEY = "profile_avatar_v1";
const EMPTY: PersistedAvatar = { avatarUri: null, lastUpdated: null };

export const useProfile = create<ProfileState>((set) => ({
  ...EMPTY,

  hydrate: async () => {
    const stored = await getJSON<PersistedAvatar>(STORAGE_KEY, EMPTY);
    set({
      avatarUri: stored.avatarUri ?? null,
      lastUpdated: stored.lastUpdated ?? null,
    });
  },

  setAvatar: async (uri) => {
    const next: PersistedAvatar = {
      avatarUri: uri,
      lastUpdated: new Date().toISOString(),
    };
    set(next);
    await setJSON(STORAGE_KEY, next);
  },

  clearAvatar: async () => {
    set(EMPTY);
    await setJSON(STORAGE_KEY, EMPTY);
  },
}));

export const useProfileStore = useProfile;
