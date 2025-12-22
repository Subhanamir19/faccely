import { randomUUID, createHash } from "crypto";
import { Program, ProgramDay, ProgramExercise } from "../schemas/ProgramSchema.js";
import { Scores, ScoresSchema } from "../validators.js";
import {
  EXERCISES,
  EXERCISES_BY_ROLE,
  HIGH_INTENSITY_IDS,
  MEDIUM_INTENSITY_IDS,
  TargetArea,
  byTargets,
} from "./exerciseCatalog.js";

type Band = "critical" | "needs" | "moderate" | "strong";
type Phase = "foundation" | "development" | "peak";

type Rng = () => number;

type RotationState = Map<string, number>;

type WeekCounters = {
  high: number;
  medium: number;
  jawHeavyStreak: number;
  jawResistanceStreak: number;
  hadHighYesterday: boolean;
};

type AreaScore = { area: TargetArea; score: number; band: Band };

const DAY_COUNT = 70;
const EXERCISES_PER_DAY = 5;
const WEEK_DAYS = 7;
const HIGH_CAP_PER_WEEK = 4;
const MEDIUM_CAP_PER_WEEK = 5;

const UNIVERSAL_ROTATION = ["lymphatic-drainage", "fish-face"] as const;
const SUPPORT_ROTATION = ["hyoid-stretch", "neck-lift", "sternocleidomastoid-stretch"] as const;

function bandFor(score: number): Band {
  if (score < 50) return "critical";
  if (score < 65) return "needs";
  if (score < 80) return "moderate";
  return "strong";
}

function toAreaScores(scores: Scores): AreaScore[] {
  const areas: AreaScore[] = [
    { area: "jawline", score: scores.jawline, band: bandFor(scores.jawline) },
    { area: "cheekbones", score: scores.cheekbones, band: bandFor(scores.cheekbones) },
    { area: "eyes", score: scores.eyes_symmetry, band: bandFor(scores.eyes_symmetry) },
    { area: "nose", score: scores.nose_harmony, band: bandFor(scores.nose_harmony) },
  ];
  return areas.sort((a, b) => a.score - b.score);
}

function hashSeed(scores: Scores): number {
  const h = createHash("sha256").update(JSON.stringify(scores)).digest();
  return h.readUInt32BE(0);
}

// Deterministic RNG (Mulberry32)
function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function phaseFor(dayNumber: number): Phase {
  if (dayNumber <= 21) return "foundation";
  if (dayNumber <= 49) return "development";
  return "peak";
}

function isMilestoneRecovery(dayNumber: number): boolean {
  return dayNumber === 21 || dayNumber === 42 || dayNumber === 63;
}

function cloneExercise(e: ProgramExercise, order: number): ProgramExercise {
  return { ...e, order };
}

function nextFromRotation<T>(
  list: readonly T[],
  key: string,
  rng: Rng,
  rotation: RotationState
): T {
  if (list.length === 1) return list[0];
  const next = rotation.get(key) ?? 0;
  const idx = (next + Math.floor(rng() * list.length)) % list.length;
  rotation.set(key, idx + 1);
  return list[idx];
}

function addIfMissing(list: ProgramExercise[], candidate: ProgramExercise) {
  if (!list.some((e) => e.id === candidate.id)) {
    list.push(candidate);
  }
}

function ensureUniversal(
  day: ProgramExercise[],
  rng: Rng,
  rotation: RotationState,
  mustLymphDrainage: boolean
) {
  const hasUniversal = day.some((e) => e.role === "universal");
  if (hasUniversal) return;
  const key = "universal";
  const pick = mustLymphDrainage
    ? EXERCISES.find((e) => e.id === "lymphatic-drainage")
    : nextFromRotation(
        UNIVERSAL_ROTATION,
        key,
        rng,
        rotation
      );
  const exercise =
    typeof pick === "string"
      ? EXERCISES.find((e) => e.id === pick)
      : (pick as ProgramExercise | undefined);
  if (exercise) day.push(exercise);
}

function ensureSupport(day: ProgramExercise[], rng: Rng, rotation: RotationState) {
  const hasSupport = day.some((e) => e.role === "support");
  if (hasSupport) return;
  const pickId = nextFromRotation(SUPPORT_ROTATION, "support", rng, rotation);
  const exercise = EXERCISES.find((e) => e.id === pickId);
  if (exercise) day.push(exercise);
}

function capIntensity(
  day: ProgramExercise[],
  counters: WeekCounters,
  phase: Phase
): ProgramExercise[] {
  const highCap = phase === "foundation" ? 2 : HIGH_CAP_PER_WEEK;
  const mediumCap = MEDIUM_CAP_PER_WEEK;
  let highCount = counters.high;
  let mediumCount = counters.medium;
  const filtered: ProgramExercise[] = [];

  for (const e of day) {
    if (HIGH_INTENSITY_IDS.has(e.id)) {
      if (highCount >= highCap) {
        // Replace with a low/universal fallback to avoid overloading.
        const fallback =
          EXERCISES.find((x) => x.role === "universal") ??
          EXERCISES.find((x) => x.role === "support");
        if (fallback) {
          filtered.push(fallback);
        }
        continue;
      }
      highCount += 1;
    }
    if (MEDIUM_INTENSITY_IDS.has(e.id)) {
      if (mediumCount >= mediumCap) {
        const fallback =
          EXERCISES.find((x) => x.role === "universal") ??
          EXERCISES.find((x) => x.role === "support");
        if (fallback) filtered.push(fallback);
        continue;
      }
      mediumCount += 1;
    }
    filtered.push(e);
  }
  counters.high = highCount;
  counters.medium = mediumCount;
  return filtered;
}

function avoidOverloadTriples(day: ProgramExercise[]): ProgramExercise[] {
  const ids = new Set(day.map((d) => d.id));
  const jawOverload = ["jaw-resistance", "upward-chewing", "chin-tucks"];
  const cheekOverload = ["cps", "alternating-cheek-puffs", "eyes-and-cheeks"];
  const neckOverload = ["hyoid-stretch", "sternocleidomastoid-stretch", "neck-lift"];

  function trimCombo(combo: string[], role?: ProgramExercise["role"]) {
    if (combo.every((id) => ids.has(id))) {
      for (const id of combo.slice(-1)) {
        const idx = day.findIndex((d) => d.id === id && (!role || d.role === role));
        if (idx >= 0) {
          day.splice(idx, 1);
          break;
        }
      }
    }
  }

  trimCombo(jawOverload, "primary");
  trimCombo(cheekOverload, "primary");
  trimCombo(neckOverload, "support");
  return day;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function signature(day: ProgramExercise[]): string {
  return day
    .map((d) => d.id)
    .sort()
    .join("|");
}

function isWeak(area: TargetArea, scores: AreaScore[]): boolean {
  return scores[0].area === area || scores[1]?.area === area;
}

function addAreaFocus(
  list: ProgramExercise[],
  area: TargetArea,
  band: Band,
  rotation: RotationState,
  rng: Rng
) {
  const primaries = byTargets(area, "primary");
  const secondaries = byTargets(area, "secondary");
  const multis = EXERCISES_BY_ROLE.secondary.filter((e) => e.targets.includes(area));

  const takePrimary = () => nextFromRotation(primaries, `primary:${area}`, rng, rotation);
  const takeSecondary = () => nextFromRotation(secondaries, `secondary:${area}`, rng, rotation);
  const takeMulti = () =>
    nextFromRotation(multis.length ? multis : primaries, `multi:${area}`, rng, rotation);

  switch (band) {
    case "critical": {
      addIfMissing(list, takePrimary());
      addIfMissing(list, takeSecondary());
      addIfMissing(list, takePrimary());
      break;
    }
    case "needs": {
      addIfMissing(list, takePrimary());
      addIfMissing(list, takeSecondary());
      break;
    }
    case "moderate": {
      addIfMissing(list, takePrimary());
      break;
    }
    case "strong": {
      addIfMissing(list, takeMulti());
      break;
    }
  }
}

function addMultiBenefit(list: ProgramExercise[], rng: Rng, rotation: RotationState) {
  const thumb = EXERCISES.find((e) => e.id === "thumb-pulling");
  const noseTongue = EXERCISES.find((e) => e.id === "nose-tongue-touch");
  const pool = [thumb, noseTongue].filter(Boolean) as ProgramExercise[];
  if (!pool.length) return;
  const pick = nextFromRotation(pool, "multiBenefit", rng, rotation);
  addIfMissing(list, pick);
}

function buildDay(
  dayNumber: number,
  scores: AreaScore[],
  counters: WeekCounters,
  rotation: RotationState,
  rng: Rng,
  prevSignature: string | null
): ProgramDay {
  const dayOfWeek = (dayNumber - 1) % WEEK_DAYS;
  const weekNumber = Math.floor((dayNumber - 1) / WEEK_DAYS) + 1;
  const phase = phaseFor(dayNumber);
  const isRecoveryDay = dayOfWeek === 6 || isMilestoneRecovery(dayNumber);
  const primaryArea = scores[0].area;
  const secondaryArea = scores[1]?.area ?? primaryArea;
  const tertiaryArea = scores[2]?.area ?? secondaryArea;

  const dayExercises: ProgramExercise[] = [];
  const focusAreas: TargetArea[] = [];

  if (isRecoveryDay) {
    focusAreas.push(primaryArea, secondaryArea);
    const recoverySet = [
      EXERCISES.find((e) => e.id === "lymphatic-drainage"),
      EXERCISES.find((e) => e.id === "fish-face"),
      EXERCISES.find((e) => e.id === "sternocleidomastoid-stretch"),
      EXERCISES.find((e) => e.id === "hyoid-stretch"),
      EXERCISES.find((e) => e.id === "neck-lift"),
    ].filter(Boolean) as ProgramExercise[];
    while (dayExercises.length < EXERCISES_PER_DAY && recoverySet.length) {
      const pick = nextFromRotation(recoverySet, "recovery", rng, rotation);
      addIfMissing(dayExercises, pick);
    }
  } else if (dayOfWeek === 0 || dayOfWeek === 3) {
    focusAreas.push(primaryArea);
    const primaryBand = scores.find((s) => s.area === primaryArea)?.band ?? "moderate";
    addAreaFocus(dayExercises, primaryArea, primaryBand, rotation, rng);
    const secondaryBand = scores.find((s) => s.area === secondaryArea)?.band ?? "moderate";
    if (primaryBand !== "critical") {
      addAreaFocus(dayExercises, secondaryArea, secondaryBand, rotation, rng);
    }
  } else if (dayOfWeek === 1 || dayOfWeek === 4) {
    focusAreas.push(primaryArea, secondaryArea);
    const primaryBand = scores.find((s) => s.area === primaryArea)?.band ?? "moderate";
    const secondBand = scores.find((s) => s.area === secondaryArea)?.band ?? "moderate";
    addAreaFocus(dayExercises, primaryArea, primaryBand, rotation, rng);
    addAreaFocus(dayExercises, secondaryArea, secondBand, rotation, rng);
  } else if (dayOfWeek === 2 || dayOfWeek === 5) {
    focusAreas.push(secondaryArea, tertiaryArea);
    const bandSecondary = scores.find((s) => s.area === secondaryArea)?.band ?? "moderate";
    const bandTertiary = scores.find((s) => s.area === tertiaryArea)?.band ?? "moderate";
    addAreaFocus(dayExercises, secondaryArea, bandSecondary, rotation, rng);
    addAreaFocus(dayExercises, tertiaryArea, bandTertiary, rotation, rng);
  }

  const multiLowCount = scores.filter((s) => s.score < 65).length;
  if (multiLowCount >= 2) {
    addMultiBenefit(dayExercises, rng, rotation);
  }

  const mustLymphDrainage = counters.hadHighYesterday || counters.jawResistanceStreak >= 3;
  ensureUniversal(dayExercises, rng, rotation, mustLymphDrainage);
  ensureSupport(dayExercises, rng, rotation);

  while (dayExercises.length < EXERCISES_PER_DAY) {
    const maintenancePool =
      EXERCISES_BY_ROLE.universal
        .concat(EXERCISES_BY_ROLE.support)
        .concat(EXERCISES_BY_ROLE.secondary);
    const next = nextFromRotation(maintenancePool, "fill", rng, rotation);
    addIfMissing(dayExercises, next);
  }

  const trimmed = avoidOverloadTriples(dayExercises);
  while (trimmed.length < EXERCISES_PER_DAY) {
    const filler =
      EXERCISES_BY_ROLE.universal.find((e) => !trimmed.some((d) => d.id === e.id)) ??
      EXERCISES_BY_ROLE.support.find((e) => !trimmed.some((d) => d.id === e.id)) ??
      EXERCISES_BY_ROLE.secondary.find((e) => !trimmed.some((d) => d.id === e.id));
    if (filler) trimmed.push(filler);
    else break;
  }
  const intensityCapped = capIntensity(trimmed, counters, phase);
  const ordered = shuffle(intensityCapped, rng).slice(0, EXERCISES_PER_DAY);

  const sign = signature(ordered);
  if (prevSignature && sign === prevSignature) {
    // Swap universal/support to avoid repeat
    const swapCandidate =
      ordered.find((e) => e.role === "universal") ?? ordered.find((e) => e.role === "support");
    const altUniversal = EXERCISES.find(
      (e) => e.role === "universal" && e.id !== swapCandidate?.id
    );
    if (swapCandidate && altUniversal) {
      const idx = ordered.findIndex((e) => e.id === swapCandidate.id);
      ordered[idx] = altUniversal;
    }
  }

  // Update streaks for fatigue management
  const hasJawResistance = ordered.some((e) => e.id === "jaw-resistance");
  counters.jawResistanceStreak = hasJawResistance ? counters.jawResistanceStreak + 1 : 0;
  counters.hadHighYesterday = ordered.some((e) => HIGH_INTENSITY_IDS.has(e.id));

  const jawHeavy = ordered.some((e) => e.targets.includes("jawline"));
  counters.jawHeavyStreak = jawHeavy ? counters.jawHeavyStreak + 1 : 0;
  if (counters.jawHeavyStreak > 2 && !isRecoveryDay) {
    // force lighter end if too many jaw-heavy days
    const replaceIdx = ordered.findIndex((e) => HIGH_INTENSITY_IDS.has(e.id));
    if (replaceIdx >= 0) {
      const light = EXERCISES.find((e) => e.role === "universal");
      if (light) ordered[replaceIdx] = light;
    }
  }

  return {
    dayNumber,
    weekNumber,
    phase,
    focusAreas: Array.from(new Set(focusAreas)),
    isRecovery: isRecoveryDay,
    exercises: ordered.map((e, i) => cloneExercise(e, i + 1)),
  };
}

export function generateProgramFromScores(rawScores: Scores): Program {
  const scores = ScoresSchema.parse(rawScores);
  const areaScores = toAreaScores(scores);
  const seed = hashSeed(scores);
  const rng = createRng(seed);
  const rotation: RotationState = new Map();

  const programId = randomUUID();
  const createdAt = new Date().toISOString();
  const days: ProgramDay[] = [];

  let prevSig: string | null = null;
  let counters: WeekCounters = {
    high: 0,
    medium: 0,
    jawHeavyStreak: 0,
    jawResistanceStreak: 0,
    hadHighYesterday: false,
  };

  for (let i = 1; i <= DAY_COUNT; i++) {
    if ((i - 1) % WEEK_DAYS === 0) {
      counters = {
        high: 0,
        medium: 0,
        jawHeavyStreak: 0,
        jawResistanceStreak: 0,
        hadHighYesterday: false,
      };
    }
    const day = buildDay(i, areaScores, counters, rotation, rng, prevSig);
    days.push(day);
    prevSig = signature(day.exercises);
  }

  return {
    programId,
    createdAt,
    version: "v1",
    scoresSnapshot: scores,
    dayCount: DAY_COUNT,
    exerciseCount: EXERCISES_PER_DAY,
    days,
  };
}
