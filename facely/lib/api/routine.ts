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
  week_focus: z.string().optional(),
  tasks: z.array(ROUTINE_TASK_SCHEMA).optional(),
  components: z.array(ROUTINE_TASK_SCHEMA).optional(),
  notes: z.array(z.string()).optional(),
  review_checks: z.array(z.string()).optional(),
});

const WEEK_FOCUS_ENTRY = z.object({
  week: z.number().int().nonnegative().optional(),
  focus: z.string().optional(),
});

const PHASE_PLAN_ENTRY = z.object({
  week: z.number().int().nonnegative().optional(),
  focus: z.string().optional(),
  volume_pct: z.number().optional(),
});

const ROUTINE_PLAN_SCHEMA = z.object({
  planHash: z.string().optional(),
  startDateISO: z.string().optional(),
  title: z.string().optional(),
  currentWeekFocus: z.string().optional(),
  focusByWeek: z.record(z.string(), z.string()).optional(),
  weeks: z.array(WEEK_FOCUS_ENTRY).optional(),
  phase_plan: z.array(PHASE_PLAN_ENTRY).optional(),
  metric: z.string().optional(),
  days: z.array(DAY_PLAN_SCHEMA).default([]),
  global_rules_applied: z.array(z.string()).optional(),

});

export type RoutineTask = {
  id: string;
  headline: string;
  category?: string;
  protocol?: string;
  done: boolean;
};
export type DayPlan = {
  day: number;
  focus?: string | null;
  weekFocus?: string | null;
  tasks: RoutineTask[];
  notes?: string[];
  reviewChecks?: string[];
};
export type RoutinePlan = {
  planHash: string | null;
  startDateISO: string | null;
  title?: string | null;
  currentWeekFocus?: string | null;
  weekFocusByWeek: Record<number, string>;
  metric?: string | null;
  phasePlan?: Array<{ week: number; focus: string; volumePct?: number | null }>;
  globalRulesApplied?: string[];
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
    const rawTasks = Array.isArray(day.tasks) && day.tasks.length > 0
      ? day.tasks
      : Array.isArray(day.components) && day.components.length > 0
      ? day.components
      : [];

    const sanitizedTasks = rawTasks
      .map((task, taskIndex) => {
        const headline = task.headline?.trim();
        const protocol = task.protocol?.trim();
        const category = task.category?.trim();

        return {
          id: String(task.id ?? `${index}-${taskIndex}`),
          headline: headline && headline.length > 0 ? headline : `Task ${taskIndex + 1}`,
          category: category && category.length > 0 ? category : undefined,
          protocol: protocol && protocol.length > 0 ? protocol : undefined,
          done: task.done ?? false,
        };
      })
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

    const notes = Array.isArray(day.notes)
    ? day.notes
        .map((note) => note?.trim())
        .filter((note): note is string => !!note && note.length > 0)
    : [];

  const reviewChecks = Array.isArray(day.review_checks)
    ? day.review_checks
        .map((check) => check?.trim())
        .filter((check): check is string => !!check && check.length > 0)
    : [];

  const weekFocusOverride =
    day.weekFocus?.trim() ||
    (typeof day.week_focus === "string" ? day.week_focus.trim() : undefined);

    return {
      day: typeof day.day === "number" && Number.isFinite(day.day) ? day.day : index + 1,
      focus: day.focus?.trim() || null,
      weekFocus: weekFocusOverride || focusByWeek.get(Math.floor(index / 7)) || null,

      tasks: sanitizedTasks,
      notes: notes.length > 0 ? notes : undefined,
      reviewChecks: reviewChecks.length > 0 ? reviewChecks : undefined,
    };
  });

  const phasePlan = (parsed.phase_plan ?? [])
    .map((entry, idx) => {
      const focus = entry.focus?.trim();
      if (!focus) return null;
      const weekNumber =
        typeof entry.week === "number" && Number.isFinite(entry.week)
          ? Math.max(1, Math.floor(entry.week))
          : idx + 1;
      const volumePct =
        typeof entry.volume_pct === "number" && Number.isFinite(entry.volume_pct)
          ? entry.volume_pct
          : null;
      return { week: weekNumber, focus, volumePct };
    })
    .filter((entry): entry is { week: number; focus: string; volumePct: number | null } => entry !== null);

  const globalRules = (parsed.global_rules_applied ?? [])
    .map((rule) => rule?.trim())
    .filter((rule): rule is string => !!rule && rule.length > 0);

  const autoHash = fingerprintPlan(days, focusByWeek);
  return {
    planHash: parsed.planHash ?? autoHash,
    startDateISO: parsed.startDateISO ?? null,
    title: parsed.title?.trim() || null,
    currentWeekFocus: parsed.currentWeekFocus?.trim() || undefined,
    weekFocusByWeek: Object.fromEntries(focusByWeek.entries()),
    metric: parsed.metric?.trim() || null,
    phasePlan: phasePlan.length > 0 ? phasePlan : undefined,
    globalRulesApplied: globalRules.length > 0 ? globalRules : undefined,
    days,
  };
}

function collectWeekFocus(parsed: z.infer<typeof ROUTINE_PLAN_SCHEMA>): Map<number, string> {
  const focus = new Map<number, string>();

  const applyFocus = (weekIndex: number, raw?: string | null) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    focus.set(Math.max(0, weekIndex), trimmed);
  };

  if (parsed.focusByWeek) {
    for (const [weekKey, value] of Object.entries(parsed.focusByWeek)) {
      const weekNumber = Number(weekKey);
      if (Number.isNaN(weekNumber)) continue;
      const normalized = weekNumber >= 1 ? Math.floor(weekNumber) - 1 : Math.floor(weekNumber);
      applyFocus(normalized, value);
    }
  }

  if (parsed.weeks) {
    parsed.weeks.forEach((entry, idx) => {
      const normalizedWeek =
        typeof entry.week === "number" && Number.isFinite(entry.week)
          ? entry.week >= 1
            ? Math.floor(entry.week) - 1
            : Math.floor(entry.week)
          : idx;
      applyFocus(normalizedWeek, entry.focus);
    });
  }

  if (parsed.phase_plan) {
    parsed.phase_plan.forEach((entry, idx) => {
      const normalizedWeek =
        typeof entry.week === "number" && Number.isFinite(entry.week)
          ? entry.week >= 1
            ? Math.floor(entry.week) - 1
            : Math.floor(entry.week)
          : idx;
      applyFocus(normalizedWeek, entry.focus);
    });
  }

  if (parsed.currentWeekFocus) {
    applyFocus(0, parsed.currentWeekFocus);

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