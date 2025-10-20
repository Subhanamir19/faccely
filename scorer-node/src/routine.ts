// scorer-node/src/routine.ts
import crypto from "crypto";
import OpenAI from "openai";
import { ZodError, type ZodIssue } from "zod";

import { ENV } from "./env.js";
import {
  RoutinePlan,
  RoutinePlanSchema,
  RoutineReq,
} from "./validators.js";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const cache = new Map<string, { value: RoutinePlan; ts: number }>();
const inFlight = new Map<string, Promise<RoutinePlan>>();

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

let routineResponseFormatLogged = false;

export class RoutineParseError extends Error {
  readonly rawPreview: string;

  constructor(raw: string) {
    super("Routine generation failed: upstream response was not valid JSON.");
    this.name = "RoutineParseError";
    this.rawPreview = truncate(raw, 1200);
  }
}

export class ValidationError extends Error {
  readonly issues?: ZodIssue[];

  constructor(entity: string, issues?: ZodIssue[]) {
    super(entity);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

const ROUTINE_SYSTEM_PROMPT = `You are the Routine Generation Engine for the Sigma Max system.

────────────────────────
PURPOSE
────────────────────────
Generate a 30-day progressive routine using ONLY the official primary protocols below.
Each day contains exactly five (5) concise components, one per on-screen card:
- headline  → metric name  (e.g. “Jawline”)
- category → sub-domain  (“Posture”, “Skincare”, “Nutrition”, etc.)
- protocol → short actionable one-liner (under 10 words)

────────────────────────
PRIMARY PROTOCOL LIBRARY (“THE SAUCE”)
────────────────────────
GLASS SKIN:
- gs-basics → “Wash + Moisturize + SPF 30”
- gs-exfoliate-2x → “Exfoliate 2× / week to clear pores”
- gs-retinol-intro → “Apply retinol 0.25% night twice weekly”
- gs-eye-serum → “Eye serum with HA + peptides PM”
- gs-accutane-referral → “Consult dermatologist for Accutane advice”

DEBLOATING:
- db-chew25 → “Chew each bite 25 times”
- db-swallow-correction → “Swallow using tongue, not cheeks”
- db-walk10 → “10-min walk after meal”
- db-electrolyte-3to2 → “Balance Na:K ≈ 3:2 daily”
- db-seed-oil-exit → “Eliminate seed oils from diet”
- db-cinnamon-fruit → “Add Ceylon cinnamon to fruit”

FACIAL SYMMETRY:
- fs-thumbpull-chintuck → “Thumb pull + chin tuck 2×30 s”
- fs-tongue-chew → “Tongue chew 6 min for balance”
- fs-ocular-oris → “Eye + mouth muscle drill 1 min each”
- fs-hang-bar → “Hang from bar 3×30 s for posture”
- fs-sprint → “Sprint 30 s × 3 sets”

MAXILLA:
- mx-mu-lift → “MU lift during workout (5 min)”
- mx-nasal-breath → “Nasal breathe 7 min daily”
- mx-hard-foods → “Eat hard foods for jaw activation”

HUNTER EYES:
- he-orbicularis-training → “Eye resistance close 3×10 reps”
- he-frontalis-relax → “Keep eyebrows relaxed today”
- he-brow-care → “Brush + oil brows for growth”

CHEEKBONES:
- ck-lateral-thumbpull → “Lateral thumb pull 3×30 s”
- ck-swallow-correct → “Tongue-led swallow only”
- ck-tongue-mastic → “Chew mastic gum 6 min”

NOSE:
- ns-thumbpull-chintuck → “Thumb pull + chin tuck 2×30 s”
- ns-genioglossus-strength → “Press tongue to palate 10 reps”
- ns-nasion-tap-temp → “Tap bridge lightly 30 s (Gua Sha)”
- ns-lpo-diet → “Cut lectins, phytates, oxalates”
- ns-clay-topical → “Apply clay mask 10 min”

JAWLINE:
- jw-posture-chintuck → “Chin tuck 2×20 s against wall”
- jw-nasal-breathe → “Deep nasal breathing 5 min”
- jw-thumbpush-anterior-maxilla → “Thumb push on palate 3×30 s”
- jw-chew20 → “Chew real food 20× per bite”
- jw-avoid-gum-trend → “Avoid jawline gum”

────────────────────────
PERIODIZATION
────────────────────────
Weeks 1–4 → Foundation → Build → Peak → Consolidate
Overload via duration/sets/frequency; week 4 deload ≤ 70 % peak.

────────────────────────
HARD CONSTRAINTS
────────────────────────
1. Exactly 5 components per day.
2. Total time ≤ user.daily_minutes (≈ 20 min).
3. Never pair retinol & exfoliation same day.
4. Sprint sessions ≥ 48 h apart.
5. Avoid stacking high-volume oral drills (chew ≥ 8 min or thumb-pull ≥ 3×40 s) with sprints.
6. TMJ_risk → chew ≤ 4 min, skip week-3 overreach.
7. irritation_grade ≥ 2 → next day recovery routines only.
8. Always include one “Review Progress” component on days 7, 14, 21, 28.
9. Across any 7 days → ≥ 3 distinct headlines must appear.
10. No new blocks outside primary library.

────────────────────────
OUTPUT FORMAT
────────────────────────
{
  "metric": "string",
  "phase_plan": [
    {"week":1,"focus":"Foundation","volume_pct":0.7},
    {"week":2,"focus":"Build","volume_pct":0.85},
    {"week":3,"focus":"Peak","volume_pct":1.1},
    {"week":4,"focus":"Consolidate","volume_pct":0.65}
  ],
  "days": [
    {
      "day": 1,
      "components": [
        {"headline":"Jawline","category":"Posture","protocol":"Chin tuck 2×20 s"},
        {"headline":"Maxilla","category":"Breathing","protocol":"Nasal breathe 5 min"},
        {"headline":"Glass Skin","category":"Skincare","protocol":"Wash + Moisturize + SPF"},
        {"headline":"Debloat","category":"Nutrition","protocol":"10-min walk after lunch"},
        {"headline":"Cheekbones","category":"Oral Drill","protocol":"Tongue chew 4 min"}
      ],
      "notes":["Baseline day — no actives"],
      "review_checks":["irritation_grade","adherence"]
    }
  ],
  "global_rules_applied":[
    "5_tasks_per_day_limit",
    "no_retinol_with_exfoliation",
    "retinol_ramp_0-2-3-2_per_week",
    "deload_week4"
  ]
}

Return valid JSON only. No markdown, no commentary.`;

export async function generateRoutinePlan(req: RoutineReq): Promise<RoutinePlan> {
  const normalized = normalizeRoutineRequest(req);
  const key = sha256Hex(JSON.stringify(normalized));

  const cached = getCache(key);
  if (cached) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const requestPayload = { ...req, daily_minutes: req.daily_minutes ?? 20 };

    const response_format: { type: "json_object"; json_schema?: unknown } = {
      type: "json_object",
    };
    if (!routineResponseFormatLogged) {
      console.log("[RF-CHECK]", {
        type: response_format.type,
        hasSchema: !!response_format.json_schema,
      });
      routineResponseFormatLogged = true;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 2000,
      response_format,

      messages: [
        { role: "system", content: ROUTINE_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(requestPayload) },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";

    if (raw) {
      console.debug("[generateRoutinePlan] completion preview:", truncate(raw, 1200));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new RoutineParseError(raw);
    }

    try {
      const validated = RoutinePlanSchema.parse(parsed);
      setCache(key, validated);
      return validated;
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError("RoutinePlan", err.issues);
      }
      throw err;
    }
  })()
    .catch((err) => {
      throw err;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}

function normalizeRoutineRequest(req: RoutineReq) {
  const dailyMinutes = req.daily_minutes ?? 20;
  return {
    age: req.age,
    gender: req.gender ?? null,
    ethnicity: req.ethnicity?.trim() || null,
    daily_minutes: dailyMinutes,
    metrics: [...req.metrics]
      .map((metric) => ({
        key: metric.key,
        score: metric.score,
        notes: metric.notes?.trim() || null,
      }))
      .sort((a, b) => {
        if (a.key === b.key) {
          if (a.score === b.score) {
            return (a.notes || "").localeCompare(b.notes || "");
          }
          return a.score - b.score;
        }
        return a.key.localeCompare(b.key);
      }),
  };
}

function getCache(key: string): RoutinePlan | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, { value: hit.value, ts: Date.now() });
  return hit.value;
}

function setCache(key: string, value: RoutinePlan) {
  cache.set(key, { value, ts: Date.now() });
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function truncate(raw: string, max: number) {
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…(truncated)`;
}