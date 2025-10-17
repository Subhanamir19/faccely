// facely/lib/api/routine.ts
import { z } from "zod";
import { API_BASE } from "./config";

const ROUTINE_TASK_SCHEMA = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  headline: z.string().optional(),
  category: z.string().optional(),
  protocol: z.string().optional(),
  done: z.boolean().optional(),
});

const DAY_PLAN_SCHEMA = z.object({
  day: z.number().int().nonnegative().optional(),
  focus: z.string().optional(),
  weekFocus: z.string().optional(),
  tasks: z.array(ROUTINE_TASK_SCHEMA).default([]),
});

const WEEK_FOCUS_ENTRY = z.object({
  week: z.number().int().nonnegative().optional(),
  focus: z.string().optional(),
});

const ROUTINE_PLAN_SCHEMA = z.object({
  planHash: z.string().optional(),
  startDateISO: z.string().optional(),
  title: z.string().optional(),
  currentWeekFocus: z.string().optional(),
  focusByWeek: z.record(z.string(), z.string()).optional(),
  weeks: z.array(WEEK_FOCUS_ENTRY).optional(),
  days: z.array(DAY_PLAN_SCHEMA).default([]),
});

export type RoutineTask = z.infer<typeof ROUTINE_TASK_SCHEMA> & { id: string; headline: string };
export type DayPlan = {
  day: number;
  focus?: string | null;
  weekFocus?: string | null;
  tasks: RoutineTask[];
};
export type RoutinePlan = {
  planHash: string | null;
  startDateISO: string | null;
  title?: string | null;
  currentWeekFocus?: string | null;
  weekFocusByWeek: Record<number, string>;
  days: DayPlan[];
};

export type RoutineReq = {
  age: number;
  gender?: "male" | "female" | "other";
  ethnicity?: string;
  metrics: Array<{ key: string; score: number; notes?: string }>;
};

export function buildRoutineReq(input: {
  age: number;
  gender?: "male" | "female" | "other";
  ethnicity?: string;
  scores: Record<string, number | undefined>;
  notes?: Partial<Record<string, string>>;
}): RoutineReq {
  const metrics = Object.keys(input.scores)
    .filter((key) => typeof input.scores[key] === "number")
    .map((key) => ({
      key,
      score: clamp(Math.round(input.scores[key] as number), 0, 100),
      notes: input.notes?.[key],
    }));

  return {
    age: input.age,
    gender: input.gender,
    ethnicity: input.ethnicity,
    metrics,
  };
}

export async function fetchRoutine(
  body: RoutineReq,
  signal?: AbortSignal
): Promise<RoutinePlan> {
  const res = await fetch(`${API_BASE}/routine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const parts = [parsed?.detail, parsed?.error, parsed?.status]
          .filter((x) => typeof x === "string" || typeof x === "number")
          .map(String);
        if (parts.length) message = parts.join(" · ");
      } catch {
        message = `${message} ${raw}`.trim();
      }
    }
    throw new Error(message || "Request failed");
  }

  const json = await res.json();
  return normalizeRoutinePlan(json);
}

function normalizeRoutinePlan(input: unknown): RoutinePlan {
  const parsed = ROUTINE_PLAN_SCHEMA.parse(input);
  const focusByWeek = collectWeekFocus(parsed);

  const days = parsed.days.slice(0, 30).map((day, index) => {
    const sanitizedTasks = day.tasks
      .map((task, taskIndex) => ({
        id: String(task.id ?? `${index}-${taskIndex}`),
        headline: task.headline?.trim() || `Task ${taskIndex + 1}`,
        category: task.category?.trim() || undefined,
        protocol: task.protocol?.trim() || undefined,
        done: task.done ?? false,
      }))
      .slice(0, 5);

    while (sanitizedTasks.length < 5) {
      const fillerIndex = sanitizedTasks.length;
      sanitizedTasks.push({
        id: `${index}-${fillerIndex}-placeholder`,
        headline: `Task ${fillerIndex + 1}`,
        category: undefined,
        protocol: undefined,
        done: false,
      });
    }

    return {
      day: typeof day.day === "number" && Number.isFinite(day.day) ? day.day : index + 1,
      focus: day.focus?.trim() || null,
      weekFocus: day.weekFocus?.trim() || focusByWeek.get(Math.floor(index / 7)) || null,
      tasks: sanitizedTasks,
    };
  });

  const autoHash = fingerprintPlan(days, focusByWeek);
  return {
    planHash: parsed.planHash ?? autoHash,
    startDateISO: parsed.startDateISO ?? null,
    title: parsed.title ?? null,
    currentWeekFocus: parsed.currentWeekFocus ?? undefined,
    weekFocusByWeek: Object.fromEntries(focusByWeek.entries()),
    days,
  };
}

function collectWeekFocus(parsed: z.infer<typeof ROUTINE_PLAN_SCHEMA>): Map<number, string> {
  const focus = new Map<number, string>();

  if (parsed.focusByWeek) {
    for (const [weekKey, value] of Object.entries(parsed.focusByWeek)) {
      const week = Number(weekKey);
      if (!Number.isNaN(week) && value) {
        focus.set(week, value.trim());
      }
    }
  }

  if (parsed.weeks) {
    parsed.weeks.forEach((entry, idx) => {
      if (!entry.focus) return;
      const week = typeof entry.week === "number" && Number.isFinite(entry.week) ? entry.week : idx;
      focus.set(week, entry.focus.trim());
    });
  }

  if (parsed.currentWeekFocus) {
    focus.set(0, parsed.currentWeekFocus.trim());
  }

  return focus;
}

function fingerprintPlan(days: DayPlan[], focus: Map<number, string>): string {
  const signature = {
    weeks: Array.from(focus.entries()),
    days: days.map((d) => ({
      day: d.day,
      focus: d.focus,
      weekFocus: d.weekFocus,
      tasks: d.tasks.map((t) => ({
        id: t.id,
        headline: t.headline,
        category: t.category,
        protocol: t.protocol,
      })),
    })),
  };

  return JSON.stringify(signature);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}