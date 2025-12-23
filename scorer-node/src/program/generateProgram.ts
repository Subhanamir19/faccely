import { randomUUID } from "crypto";
import { Program, ProgramDay, ProgramExercise } from "../schemas/ProgramSchema.js";
import { Scores, ScoresSchema } from "../validators.js";
import { EXERCISES } from "./exerciseCatalog.js";
import { PROGRAM_1, PROGRAM_2, PROGRAM_3, type ParsedProgram } from "./programData.js";

type Phase = "foundation" | "development" | "peak";

const BENCHMARK = 80;

/**
 * Determine phase based on day number
 */
function phaseFor(dayNumber: number): Phase {
  if (dayNumber <= 21) return "foundation";
  if (dayNumber <= 49) return "development";
  return "peak";
}

/**
 * Select program based on score gaps
 *
 * Algorithm:
 * 1. Calculate gaps for each metric (max(0, BENCHMARK - score))
 * 2. Sum gaps into 3 buckets:
 *    - Bucket 1: jawline + cheekbones + sexual_dimorphism
 *    - Bucket 2: eyes_symmetry + nose_harmony + facial_symmetry
 *    - Bucket 3: skin_quality
 * 3. Highest bucket wins
 * 4. Ties broken by biggest single weakness
 */
function selectProgramFromScores(scores: Scores): ParsedProgram {
  // Calculate gaps
  const gaps = {
    jawline: Math.max(0, BENCHMARK - scores.jawline),
    cheekbones: Math.max(0, BENCHMARK - scores.cheekbones),
    sexual_dimorphism: Math.max(0, BENCHMARK - scores.sexual_dimorphism),
    eyes_symmetry: Math.max(0, BENCHMARK - scores.eyes_symmetry),
    nose_harmony: Math.max(0, BENCHMARK - scores.nose_harmony),
    facial_symmetry: Math.max(0, BENCHMARK - scores.facial_symmetry),
    skin_quality: Math.max(0, BENCHMARK - scores.skin_quality),
  };

  // Bucket totals
  const bucket1 = gaps.jawline + gaps.cheekbones + gaps.sexual_dimorphism;
  const bucket2 = gaps.eyes_symmetry + gaps.nose_harmony + gaps.facial_symmetry;
  const bucket3 = gaps.skin_quality;

  // Find winner
  const max = Math.max(bucket1, bucket2, bucket3);

  // Tiebreaker: biggest single weakness
  if (max === bucket1 && max === bucket2) {
    const max1 = Math.max(gaps.jawline, gaps.cheekbones, gaps.sexual_dimorphism);
    const max2 = Math.max(gaps.eyes_symmetry, gaps.nose_harmony, gaps.facial_symmetry);
    return max1 >= max2 ? PROGRAM_1() : PROGRAM_2();
  }

  if (max === bucket1 && max === bucket3) {
    const max1 = Math.max(gaps.jawline, gaps.cheekbones, gaps.sexual_dimorphism);
    return max1 >= gaps.skin_quality ? PROGRAM_1() : PROGRAM_3();
  }

  if (max === bucket2 && max === bucket3) {
    const max2 = Math.max(gaps.eyes_symmetry, gaps.nose_harmony, gaps.facial_symmetry);
    return max2 >= gaps.skin_quality ? PROGRAM_2() : PROGRAM_3();
  }

  // No tie
  if (max === bucket1) return PROGRAM_1();
  if (max === bucket2) return PROGRAM_2();
  return PROGRAM_3();
}

/**
 * Map parsed program to Program schema
 */
function mapParsedProgramToSchema(parsed: ParsedProgram, scores: Scores): Program {
  const days: ProgramDay[] = parsed.days.map((dayData) => {
    const exercises: ProgramExercise[] = dayData.exercises.map((exerciseId, idx) => {
      const exercise = EXERCISES.find((e) => e.id === exerciseId);

      if (!exercise) {
        throw new Error(
          `Exercise not found in catalog: "${exerciseId}" (Day ${dayData.dayNumber})`
        );
      }

      return {
        ...exercise,
        order: idx + 1,
      };
    });

    // Determine if recovery day
    const isRecovery = [7, 14, 21, 28, 35, 42, 49, 56, 63, 70].includes(dayData.dayNumber);

    return {
      dayNumber: dayData.dayNumber,
      weekNumber: Math.floor((dayData.dayNumber - 1) / 7) + 1,
      phase: phaseFor(dayData.dayNumber),
      focusAreas: parsed.focus,
      isRecovery,
      exercises,
    };
  });

  return {
    programId: randomUUID(),
    createdAt: new Date().toISOString(),
    version: "v2",
    scoresSnapshot: scores,
    dayCount: 70,
    exerciseCount: 5,
    days,
  };
}

/**
 * Generate program from scores
 *
 * This is the main entry point called by API routes.
 * Selects one of 3 pre-defined programs based on score gaps.
 */
export function generateProgramFromScores(rawScores: Scores): Program {
  const scores = ScoresSchema.parse(rawScores);
  const selectedProgram = selectProgramFromScores(scores);
  return mapParsedProgramToSchema(selectedProgram, scores);
}
