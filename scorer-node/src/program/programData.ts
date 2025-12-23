import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Parsed program structure extracted from all-3-programs.md
 */
export type ParsedProgram = {
  programNumber: 1 | 2 | 3;
  name: string;
  description: string;
  focus: string[];
  days: ProgramDayData[];
};

export type ProgramDayData = {
  dayNumber: number;
  exercises: string[]; // exercise IDs from exerciseCatalog
};

/**
 * Exercise name mapping from markdown to exercise catalog IDs
 */
const EXERCISE_NAME_MAP: Record<string, string> = {
  "CPS": "cps",
  "Thumb pulling": "thumb-pulling",
  "Chin tucks": "chin-tucks",
  "Hunter eyes 1": "hunter-eyes",
  "Hyoid stretch": "hyoid-stretch",
  "Lymphatic drainage": "lymphatic-drainage",
  "Upward chewing": "upward-chewing",
  "Neck lift": "neck-lift",
  "Jaw resistance": "jaw-resistance",
  "Eyes and cheeks": "eyes-and-cheeks",
  "Alternating cheek puffs": "alternating-cheek-puffs",
  "Nose massage": "nose-massage",
  "Lion": "lion",
  "Nose touching with tongue": "nose-tongue-touch",
  "Fish face": "fish-face",
  "Sternocleidomastoid stretch": "sternocleidomastoid-stretch",
};

/**
 * Normalize exercise name to catalog ID
 */
function normalizeExerciseName(name: string): string {
  const trimmed = name.trim();
  const mapped = EXERCISE_NAME_MAP[trimmed];

  if (mapped) return mapped;

  // Fallback: convert to lowercase kebab-case
  return trimmed.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Parse a single program section from markdown
 */
function parseProgram(
  text: string,
  programNumber: 1 | 2 | 3,
  name: string,
  description: string,
  focus: string[]
): ParsedProgram {
  const days: ProgramDayData[] = [];
  const lines = text.split("\n");

  let currentDay: number | null = null;
  let currentExercises: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at separator/metadata section (multiple dashes or "logic for")
    if (line.match(/^-{5,}/) || line.toLowerCase().startsWith("logic for")) {
      break;
    }

    // Match "Day X"
    const dayMatch = line.match(/^Day (\d+)$/);
    if (dayMatch) {
      // Save previous day if exists
      if (currentDay !== null && currentExercises.length > 0) {
        days.push({
          dayNumber: currentDay,
          exercises: currentExercises.map(normalizeExerciseName),
        });
      }

      // Start new day
      currentDay = parseInt(dayMatch[1], 10);
      currentExercises = [];
      continue;
    }

    // Skip empty lines, section headers, separators, and explanatory text
    if (
      !line ||
      line.startsWith("Days ") ||
      line.startsWith("Program ") ||
      line.startsWith("---") ||
      line.startsWith("→") ||
      line.startsWith("From ") ||
      line.endsWith(":") || // Skip lines ending with colon (section headers)
      line.includes(" become ") || // Skip explanatory phrases
      line.includes(" increases") ||
      line.includes(" stays") ||
      line.toLowerCase().includes("rules applied") ||
      line.toLowerCase().includes("one recovery") ||
      line.toLowerCase().includes("medium exercises") ||
      line.toLowerCase().includes("intensity increases")
    ) {
      continue;
    }

    // If we're collecting exercises for a day, add this line
    if (currentDay !== null) {
      currentExercises.push(line);
    }
  }

  // Save last day
  if (currentDay !== null && currentExercises.length > 0) {
    days.push({
      dayNumber: currentDay,
      exercises: currentExercises.map(normalizeExerciseName),
    });
  }

  // Validate we got all 70 days - fail hard in production
  if (days.length !== 70) {
    const error = `Program ${programNumber} parsed ${days.length}/70 days - data integrity failure`;
    console.error(`[programData] ${error}`);
    throw new Error(error);
  }

  // Validate each day has exactly 5 exercises
  for (const day of days) {
    if (day.exercises.length !== 5) {
      const error = `Program ${programNumber} Day ${day.dayNumber} has ${day.exercises.length}/5 exercises`;
      console.error(`[programData] ${error}`);
      throw new Error(error);
    }
  }

  return {
    programNumber,
    name,
    description,
    focus,
    days,
  };
}

/**
 * Resolve the markdown file path robustly across environments
 */
function resolveMarkdownPath(): string {
  // Try multiple possible locations
  const candidates = [
    // From scorer-node directory (process.cwd is scorer-node)
    join(process.cwd(), "..", "all-3-programs.md"),
    // From repo root (process.cwd is SS)
    join(process.cwd(), "all-3-programs.md"),
    // Relative to this file
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "all-3-programs.md"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    `all-3-programs.md not found. Tried:\n${candidates.map((p) => `  - ${p}`).join("\n")}`
  );
}

/**
 * Load and parse all 3 programs from markdown file
 */
function loadProgramsFromMarkdown(): [ParsedProgram, ParsedProgram, ParsedProgram] {
  const markdownPath = resolveMarkdownPath();

  let content: string;
  try {
    content = readFileSync(markdownPath, "utf-8");
  } catch (err: any) {
    throw new Error(`Failed to load all-3-programs.md at ${markdownPath}: ${err.message}`);
  }

  // Split into 3 program sections
  const sections: string[] = content.split(/Program \d+:/);

  // Remove empty first section (text before first "Program X:")
  if (sections[0].trim().length === 0) {
    sections.shift();
  }

  if (sections.length < 3) {
    throw new Error(`Expected 3 programs in markdown, found ${sections.length}`);
  }

  const program1 = parseProgram(
    sections[0],
    1,
    "Structural Foundation",
    "Daily variation, weighted logic, progressive overload",
    ["jawline", "cheekbones", "sexual_dimorphism"]
  );

  const program2 = parseProgram(
    sections[1],
    2,
    "Eyes & Midface Optimization",
    "Primary goal: Eyes, symmetry, nose, upper-midface balance",
    ["eyes", "nose", "facial_symmetry"]
  );

  const program3 = parseProgram(
    sections[2],
    3,
    "Soft Tissue & Aesthetic Refinement",
    "Goal: Skin clarity, fat reduction, lymphatic flow, facial sharpness",
    ["skin_quality"]
  );

  return [program1, program2, program3];
}

// Load programs at module init (singleton pattern)
let PROGRAMS: [ParsedProgram, ParsedProgram, ParsedProgram] | null = null;

function getPrograms(): [ParsedProgram, ParsedProgram, ParsedProgram] {
  if (!PROGRAMS) {
    PROGRAMS = loadProgramsFromMarkdown();
  }
  return PROGRAMS;
}

// Export individual programs
export const PROGRAM_1 = (): ParsedProgram => getPrograms()[0];
export const PROGRAM_2 = (): ParsedProgram => getPrograms()[1];
export const PROGRAM_3 = (): ParsedProgram => getPrograms()[2];

/**
 * Get all programs
 */
export function getAllPrograms(): [ParsedProgram, ParsedProgram, ParsedProgram] {
  return getPrograms();
}
