// store/profile.ts
// Profile avatar state with manual hydration/persistence via AsyncStorage.
import { create } from "zustand";

import { getJSON, setJSON } from "@/lib/storage";

type PersistedProfile = {
  avatarUri: string | null;
  lastUpdated: string | null;
  displayName: string | null;
};

type ProfileState = PersistedProfile & {
  hydrate: () => Promise<void>;
  setAvatar: (uri: string) => Promise<void>;
  clearAvatar: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
};

const STORAGE_KEY = "profile_avatar_v1";
const EMPTY: PersistedProfile = { avatarUri: null, lastUpdated: null, displayName: null };

export const useProfile = create<ProfileState>((set) => ({
  ...EMPTY,

  hydrate: async () => {
    const stored = await getJSON<PersistedProfile>(STORAGE_KEY, EMPTY);
    set({
      avatarUri: stored.avatarUri ?? null,
      lastUpdated: stored.lastUpdated ?? null,
      displayName: stored.displayName ?? null,
    });
  },

  setAvatar: async (uri) => {
    const next = (prev: PersistedProfile): PersistedProfile => ({
      ...prev,
      avatarUri: uri,
      lastUpdated: new Date().toISOString(),
    });
    set((s) => next(s));
    const current = await getJSON<PersistedProfile>(STORAGE_KEY, EMPTY);
    await setJSON(STORAGE_KEY, next(current));
  },

  clearAvatar: async () => {
    set((s) => ({ ...s, avatarUri: null, lastUpdated: null }));
    const current = await getJSON<PersistedProfile>(STORAGE_KEY, EMPTY);
    await setJSON(STORAGE_KEY, { ...current, avatarUri: null, lastUpdated: null });
  },

  setDisplayName: async (name) => {
    const trimmed = name.trim() || null;
    set((s) => ({ ...s, displayName: trimmed }));
    const current = await getJSON<PersistedProfile>(STORAGE_KEY, EMPTY);
    await setJSON(STORAGE_KEY, { ...current, displayName: trimmed });
  },
}));

export const useProfileStore = useProfile;
