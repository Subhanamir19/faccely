import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  type RoutinePlan,
  type RoutineReq,
  fetchRoutine,
} from "@/lib/api/routine";

type ProgressMap = Record<number, Set<string>>;

type NetworkStatus = "online" | "offline" | "degraded";

type State = {
  data: RoutinePlan | null;
  currentDay: number;
  progress: ProgressMap;
  planHash: string | null;
  startDateISO: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  networkStatus: NetworkStatus;
};

type Actions = {
  fetch: (req: RoutineReq) => Promise<void>;
  prefetch: (req: RoutineReq) => Promise<void>;
  hydrateFromCache: () => Promise<void>;
  persistProgress: () => Promise<void>;
  setDay: (day: number) => void;
  markDone: (dayIndex: number, taskId: string) => void;
  markAllDone: (dayIndex: number) => void;
  recomputeDayFromDate: (nowISO?: string) => void;
  resolveConflicts: () => void;
  reset: () => void;
};

type Store = State & Actions;

const STORAGE_PREFIX = "routine::";

export const useRoutine = create<Store>((set, get) => ({
  data: null,
  currentDay: 0,
  progress: {},
  planHash: null,
  startDateISO: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  networkStatus: "online",

  async fetch(req) {
    await performFetch(req, false, set, get);
  },

  async prefetch(req) {
    await performFetch(req, true, set, get);
  },

  async hydrateFromCache() {
    const { planHash } = get();
    if (!planHash) return;
    try {
      const cached = await AsyncStorage.getItem(storageKey(planHash));
      if (!cached) return;
      const parsed = JSON.parse(cached) as PersistedPayload;
      const progress = fromPersisted(parsed.progress);
      set((state) => ({
        progress,
        startDateISO: parsed.startDateISO ?? state.startDateISO,
      }));
      get().resolveConflicts();
      get().recomputeDayFromDate();
    } catch (err: unknown) {
      console.warn("hydrateFromCache failed", err);
    }
  },

  async persistProgress() {
    const { planHash, progress, startDateISO } = get();
    if (!planHash) return;
    try {
      const payload: PersistedPayload = {
        progress: toPersisted(progress),
        startDateISO: startDateISO ?? undefined,
      };
      await AsyncStorage.setItem(storageKey(planHash), JSON.stringify(payload));
    } catch (err: unknown) {
      console.warn("persistProgress failed", err);
    }
  },

  setDay(day) {
    const { data } = get();
    if (!data) return;
    const max = data.days.length > 0 ? data.days.length - 1 : 0;
    const clamped = Math.max(0, Math.min(day, max));
    set({ currentDay: clamped });
  },

  markDone(dayIndex, taskId) {
    const { data } = get();
    const tasks = data?.days[dayIndex]?.tasks;
    if (!tasks || !tasks.some((task) => task.id === taskId)) return;

    set((state) => {
      const next = cloneProgress(state.progress);
      const bucket = next[dayIndex] ?? new Set<string>();
      if (bucket.has(taskId)) {
        bucket.delete(taskId);
      } else {
        bucket.add(taskId);
      }
      if (bucket.size === 0) {
        delete next[dayIndex];
      } else {
        next[dayIndex] = bucket;
      }
      return { progress: next };
    });

    void get().persistProgress();
    get().recomputeDayFromDate();
  },

  markAllDone(dayIndex) {
    const { data } = get();
    const tasks = data?.days[dayIndex]?.tasks;
    if (!tasks || tasks.length === 0) return;

    set((state) => {
      const next = cloneProgress(state.progress);
      next[dayIndex] = new Set(tasks.map((task) => task.id));
      return { progress: next };
    });

    void get().persistProgress();
    get().recomputeDayFromDate();
  },

  recomputeDayFromDate(nowISO) {
    const { data, startDateISO, progress } = get();
    if (!data || data.days.length === 0) return;

    const highestCompleted = data.days.reduce((acc, day, index) => {
      const bucket = progress[index];
      if (!bucket) return acc;
      const complete = day.tasks.every((task) => bucket.has(task.id));
      return complete ? Math.max(acc, index) : acc;
    }, -1);

    let dayFromDate = 0;
    if (startDateISO) {
      const start = normalizeDate(startDateISO);
      const now = normalizeDate(nowISO ?? new Date().toISOString());
      const diff = Math.floor((now - start) / (24 * 60 * 60 * 1000));
      if (Number.isFinite(diff)) {
        dayFromDate = diff;
      }
    }

    const target = Math.min(
      data.days.length - 1,
      Math.max(dayFromDate, highestCompleted + 1, 0)
    );

    set({ currentDay: Math.max(0, target) });
  },

  resolveConflicts() {
    const { data } = get();
    if (!data) return;
    set((state) => {
      const next: ProgressMap = {};
      data.days.forEach((day, index) => {
        const bucket = state.progress[index];
        if (!bucket) return;
        const valid = new Set(day.tasks.map((task) => task.id));
        const filtered = new Set(Array.from(bucket).filter((id) => valid.has(id)));
        if (filtered.size > 0) {
          next[index] = filtered;
        }
      });
      return { progress: next };
    });
  },

  reset() {
    set({
      data: null,
      currentDay: 0,
      progress: {},
      planHash: null,
      startDateISO: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      networkStatus: "online",
    });
  },
}));

type PersistedPayload = {
  progress?: Record<string, string[]>;
  startDateISO?: string;
};

async function performFetch(
  req: RoutineReq,
  background: boolean,
  set: (partial: Partial<State>) => void,
  get: () => Store
) {
  if (background) {
    set({ isRefreshing: true, error: null });
  } else {
    set({ isLoading: true, error: null });
  }

  try {
    const plan = await fetchRoutine(req);
    const planHash = plan.planHash ?? fingerprintPlan(plan);
    const previousHash = get().planHash;

    let startDateISO = plan.startDateISO ?? get().startDateISO ?? null;
    let restoredProgress: ProgressMap = {};

    if (previousHash !== planHash) {
      const cached = await AsyncStorage.getItem(storageKey(planHash));
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as PersistedPayload;
          restoredProgress = fromPersisted(parsed.progress);
          if (parsed.startDateISO) {
            startDateISO = parsed.startDateISO;
          }
        } catch (err: unknown) {
          console.warn("Failed to parse routine cache", err);
        }
      }
    } else {
      restoredProgress = cloneProgress(get().progress);
    }

    plan.days.forEach((day, index) => {
      if (!restoredProgress[index]) {
        const completed = day.tasks
          .filter((task) => task.done)
          .map((task) => task.id);
        if (completed.length > 0) {
          restoredProgress[index] = new Set(completed);
        }
      }
    });

    if (!startDateISO) {
      startDateISO = new Date().toISOString();
    }

    set({
      data: plan,
      planHash,
      startDateISO,
      progress: restoredProgress,
      isLoading: false,
      isRefreshing: false,
      error: null,
      networkStatus: "online",
    });

    get().resolveConflicts();
    get().recomputeDayFromDate();
    await get().persistProgress();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch routine";
    set({
      isLoading: false,
      isRefreshing: false,
      error: message,
      networkStatus: message.toLowerCase().includes("network") ? "offline" : "degraded",
    });
    throw err;
  }
}

function fingerprintPlan(plan: RoutinePlan): string {
  return JSON.stringify({
    weeks: plan.weekFocusByWeek,
    days: plan.days.map((day) => ({
      day: day.day,
      tasks: day.tasks.map((task) => ({
        id: task.id,
        headline: task.headline,
        category: task.category,
        protocol: task.protocol,
      })),
    })),
  });
}

function storageKey(hash: string) {
  return `${STORAGE_PREFIX}${hash}`;
}

function toPersisted(progress: ProgressMap): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(progress).map(([day, bucket]) => [day, Array.from(bucket)])
  );
}

function fromPersisted(progress?: Record<string, string[]>): ProgressMap {
  if (!progress) return {};
  const next: ProgressMap = {};
  for (const [key, value] of Object.entries(progress)) {
    const day = Number(key);
    if (Number.isNaN(day) || !Array.isArray(value)) continue;
    next[day] = new Set(value.filter((id): id is string => typeof id === "string"));
  }
  return next;
}

function cloneProgress(progress: ProgressMap): ProgressMap {
  const next: ProgressMap = {};
  for (const [key, value] of Object.entries(progress)) {
    next[Number(key)] = new Set(value);
  }
  return next;
}

function normalizeDate(iso: string) {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return Date.UTC(year, month, day);
}