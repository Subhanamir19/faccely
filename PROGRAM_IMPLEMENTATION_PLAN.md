# Program Feature Implementation Plan

## Overview
Build a 70-day facial exercise program feature that assigns users one of three predefined programs based on their facial analysis scores. The feature focuses on progressive, phase-based routines.

---

## Current State Analysis

### ✅ What Already Exists
1. **Backend Infrastructure**
   - `programs` table in database (schema.sql:42-50)
   - `program_completions` table for tracking exercise completion (schema.sql:58-74)
   - Program generation logic (`generateProgram.ts`) - generates programs algorithmically
   - Exercise catalog with 15 exercises (`exerciseCatalog.ts`)
   - API endpoints:
     - `GET /programs/current` - fetch latest program
     - `POST /programs` - generate new program
     - `PATCH /programs/:id/completions` - mark exercise complete/incomplete

2. **Frontend Components**
   - Program tab UI ([program.tsx](c:\SS\facely\app\(tabs)\program.tsx)) showing all 70 days in grid
   - Program store with Zustand ([program.ts](c:\SS\facely\store\program.ts))
   - Day detail screen ([day].tsx) - has basic exercise player with animation
   - Completion tracking with optimistic updates

3. **Scoring System**
   - 7 facial metrics: jawline, facial_symmetry, skin_quality, cheekbones, eyes_symmetry, nose_harmony, sexual_dimorphism
   - Scores stored with each scan in `scans.scores` (jsonb)

4. **Exercise Assets**
   - Pose images in `C:\SS\facely\aligned_exercises`
   - Format: `{Exercise Name}-Pose{N}.{jpeg|png}`
   - Examples: `CPS-Pose1.png`, `Hyoid stretch-Pose3.jpeg`

### ❌ What Needs to Change

**CRITICAL MISMATCH:** The current system generates programs **algorithmically** but the requirement is to use **3 fixed programs** from `scorer-node/all-3-programs.md`.

Current logic in `generateProgram.ts`:
- Uses dynamic algorithm to build days based on scores
- Rotates exercises using RNG and rotation state
- No fixed programs

Required logic:
- Parse 3 fixed programs from `scorer-node/all-3-programs.md`
- Select 1 program based on score gaps
- Store selected program as-is (no generation)

---

## Program Selection Logic (from scorer-node/all-3-programs.md)

### The 3 Programs
1. **Program 1: Structural Foundation**
   - Focus: jawline + cheekbones + masculinity (sexual_dimorphism)
   - Core exercises: CPS, Thumb pulling (almost daily), jaw-heavy exercises
   - Who gets it: Users with biggest gap in structure metrics

2. **Program 2: Eyes & Midface Optimization**
   - Focus: eyes + nose + symmetry (facial_symmetry)
   - Core exercises: Thumb pulling, Hunter eyes 1, Eyes and cheeks, Nose massage
   - Who gets it: Users with biggest gap in eyes/midface metrics

3. **Program 3: Soft Tissue & Aesthetic Refinement**
   - Focus: skin + fat reduction + lymphatic flow
   - Core exercises: Lymphatic drainage, Lion, Fish face (daily), lighter intensity
   - Who gets it: Users with biggest gap in skin/soft tissue metrics

### Selection Algorithm
```
Set benchmark = 80 (solid threshold)

For each metric below 80:
  gap = 80 - score

Bucket 1 (Program 1): sum(gaps for jawline, cheekbones, sexual_dimorphism)
Bucket 2 (Program 2): sum(gaps for eyes_symmetry, nose_harmony, facial_symmetry)
Bucket 3 (Program 3): sum(gaps for skin_quality) + optional small symmetry contribution

Winner = bucket with highest total gap

If tie: pick bucket with biggest single weakness
```

---

## UI/UX Flow (Updated)

### Screen 1: Program Tab (Main Screen)
**Path:** `facely/app/(tabs)/program.tsx`

**Layout:**
- Header: "Your 70-Day Program" + days remaining counter
- Grid: 14 rows × 5 columns = 70 day cards
- Each card shows:
  - Day number (e.g., "Day 1", "Day 15")
  - Visual state indicator (see below)
  - Progress (e.g., "3/5 complete")
- Footer: "Regenerate" button (dev mode)

**Day Card Visual States:**
1. **Today** (current unlocked day)
   - Highlighted border (accent color)
   - Shadow/glow effect
   - Badge: "Today"
   - Interactive

2. **Past Completed Days**
   - Green checkmark icon ✓
   - Subtle green tint
   - Shows "5/5 complete"
   - Interactive (can review)

3. **Past Incomplete Days**
   - Orange/yellow warning color
   - Shows "2/5 complete"
   - Interactive

4. **Future Locked Days**
   - Grayed out / 50% opacity
   - Lock icon 🔒
   - NOT interactive (disabled)

5. **Recovery Days** (optional visual)
   - Days 7, 14, 21, 28, 35, 42, 49, 56, 63, 70
   - Small "R" badge or different border color

**Interaction:**
- Click any unlocked day → Navigate to Tasks Screen (`/program/[day]`)
- Click locked day → No action (disabled)

---

### Screen 2: Tasks Screen (Day Detail)
**Path:** `facely/app/program/[day].tsx`

**Rename:** This screen is now called "Tasks Screen" (same file, just conceptual rename)

**Layout:**
```
┌─────────────────────────────────────┐
│ [Back]              Day 15          │
│                     Phase 1 • Foundation
│                     Focus: jawline, cheekbones
│                                     │
│ Today's routine is optimized for    │
│ your jawline and structure recovery │
│                                     │
├─────────────────────────────────────┤
│ Exercises (3/5 complete)            │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ✓ CPS                           │ │
│ │   primary • high • cheekbones   │ │
│ │   [Protocol text...]            │ │
│ │                           [Done]│ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   Thumb pulling                 │ │
│ │   secondary • medium • multi    │ │
│ │   [Protocol text...]            │ │
│ │                          [Start]│ │
│ └─────────────────────────────────┘ │
│                                     │
│ ... (3 more exercises)              │
└─────────────────────────────────────┘
```

**Context Line Logic:**
- Program 1 → "Today's routine is optimized for your **jawline and structure** recovery"
- Program 2 → "Today's routine is optimized for your **eye symmetry and midface** recovery"
- Program 3 → "Today's routine is optimized for your **skin clarity and facial definition** recovery"

Can also vary by phase:
- Foundation → "building control"
- Development → "progressive loading"
- Peak → "refinement and stabilization"

**Exercise List:**
- Shows 5 exercises for the day
- Each exercise card shows:
  - Exercise name (header)
  - Role, intensity, targets (metadata)
  - Protocol (2 lines, truncated)
  - Completion badge: "Done" ✓ (green) or "Start" (accent color)

**Interaction:**
- Click any exercise → Open Completion Modal

---

### Modal 1: Completion Modal
**Triggered:** When user clicks an exercise from Tasks Screen

**Layout:**
```
┌───────────────────────────────────┐
│ CPS                               │
├───────────────────────────────────┤
│ What would you like to do?        │
│                                   │
│ [Task completed?] [Start]         │
│                                   │
│ [Close]                           │
└───────────────────────────────────┘
```

**Buttons:**
1. **"Task completed?"** (Ghost button)
   - Marks exercise as complete
   - Shows confirmation message: "✓ Exercise marked complete!"
   - Modal stays open for 1 second showing confirmation
   - Then closes automatically
   - Exercise in list shows green checkmark

2. **"Start"** (Solid button)
   - Closes Completion Modal
   - Opens Exercise Player Modal

3. **"Close"** (Ghost button)
   - Closes modal without action

---

### Modal 2: Exercise Player Modal
**Triggered:** When user clicks "Start" in Completion Modal

**Layout:**
```
┌───────────────────────────────────┐
│ CPS                               │
├───────────────────────────────────┤
│ Keep spine neutral. Puff cheeks   │
│ upward, hold 1s, release. 12 slow │
│ reps.                             │
├───────────────────────────────────┤
│ 30s timer              28s        │
├───────────────────────────────────┤
│                                   │
│    [Animation Frame Display]      │
│    (Cycles through pose images)   │
│                                   │
├───────────────────────────────────┤
│ [Close]                           │
└───────────────────────────────────┘
```

**Components:**
1. **Header:** Exercise name
2. **Protocol:** Full text of exercise instructions
3. **Timer:** 30-second countdown (updates every second)
4. **Animation:**
   - Loops through pose images (1 second per pose)
   - Example: CPS has 2 poses → shows Pose1 for 1s, Pose2 for 1s, repeat
   - Hyoid stretch has 3 poses → Pose1 (1s) → Pose2 (1s) → Pose3 (1s) → loop
5. **Close Button:** Manual close (can close before timer ends)

**Image Source:**
- Path: `C:\SS\facely\aligned_exercises\{Exercise Name}-Pose{N}.{ext}`
- Loaded via `POSE_FRAMES` mapping in `lib/programAssets.ts`

**Timer Behavior:**
- Starts at 30s, counts down to 0
- When reaches 0: Auto-close modal (optional) OR keep open
- User preference: Auto-close vs manual close

---

## Implementation Tasks

### Phase 1: Backend - Parse & Store Fixed Programs

#### Task 1.1: Create Program Data Parser
**File:** `scorer-node/src/program/programData.ts` (NEW)

**Purpose:** Parse `scorer-node/all-3-programs.md` into structured JSON

**Output Structure:**
```typescript
type ParsedProgram = {
  programNumber: 1 | 2 | 3;
  name: string;
  description: string;
  focus: string[];
  days: {
    dayNumber: number;
    exercises: string[]; // exercise names
  }[];
};
```

**Implementation:**
- Read `scorer-node/all-3-programs.md`
- Parse day sections (regex: `Day \d+`)
- Extract exercise names per day
- Map to exercise IDs from `exerciseCatalog.ts`
- Export 3 constants: `PROGRAM_1`, `PROGRAM_2`, `PROGRAM_3`

**Example Output:**
```typescript
export const PROGRAM_1: ParsedProgram = {
  programNumber: 1,
  name: "Structural Foundation",
  description: "Daily variation, weighted logic, progressive overload",
  focus: ["jawline", "cheekbones", "sexual_dimorphism"],
  days: [
    { dayNumber: 1, exercises: ["cps", "thumb-pulling", "chin-tucks", "hyoid-stretch", "lymphatic-drainage"] },
    { dayNumber: 2, exercises: ["thumb-pulling", "cps", "upward-chewing", "jaw-resistance", "neck-lift"] },
    // ... 68 more days
  ]
};
```

---

#### Task 1.2: Replace Generation Logic
**File:** `scorer-node/src/program/generateProgram.ts`

**Current:** Algorithmic generation with RNG
**New:** Selection logic based on score gaps

**New Function:**
```typescript
function selectProgramFromScores(scores: Scores): ParsedProgram {
  const BENCHMARK = 80;

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

  if (max === bucket1) return PROGRAM_1;
  if (max === bucket2) return PROGRAM_2;
  return PROGRAM_3;
}
```

**New `generateProgramFromScores` function:**
```typescript
export function generateProgramFromScores(rawScores: Scores): Program {
  const scores = ScoresSchema.parse(rawScores);
  const selectedProgram = selectProgramFromScores(scores);

  // Map parsed program to Program schema
  const days: ProgramDay[] = selectedProgram.days.map((day) => {
    const exercises = day.exercises.map((exerciseName, idx) => {
      const exercise = EXERCISES.find(e => e.id === exerciseName || e.name === exerciseName);
      if (!exercise) throw new Error(`Exercise not found: ${exerciseName}`);
      return { ...exercise, order: idx + 1 };
    });

    return {
      dayNumber: day.dayNumber,
      weekNumber: Math.floor((day.dayNumber - 1) / 7) + 1,
      phase: phaseFor(day.dayNumber),
      focusAreas: selectedProgram.focus,
      isRecovery: [7, 14, 21, 28, 35, 42, 49, 56, 63, 70].includes(day.dayNumber),
      exercises,
    };
  });

  return {
    programId: randomUUID(),
    createdAt: new Date().toISOString(),
    version: "v2", // updated version
    scoresSnapshot: scores,
    dayCount: 70,
    exerciseCount: 5,
    days,
  };
}
```

**Helper:**
```typescript
function phaseFor(dayNumber: number): Phase {
  if (dayNumber <= 21) return "foundation";
  if (dayNumber <= 49) return "development";
  return "peak";
}
```

---

#### Task 1.3: Update API Route (No Breaking Changes)
**File:** `scorer-node/src/routes/programs.ts`

**Change:** Update to use new generation logic
- Keep all endpoints unchanged
- Just calls updated `generateProgramFromScores`

No code changes needed (uses same function signature).

---

### Phase 2: Frontend - Program Tab UI

#### Task 2.1: Update Program Tab Layout
**File:** `facely/app/(tabs)/program.tsx`

**Current:** Grid with 5 columns, shows all days
**Keep:** Same grid layout (14 rows × 5 columns)

**Changes:**
1. **Update day card styling** - add visual states
2. **Add day state logic** - compute today, past, future
3. **Add completion indicators** - checkmarks, progress
4. **Disable future days** - make non-interactive
5. **Add context line** at top (program type → focus area)

**Visual State Logic:**
```typescript
type DayState = "today" | "past-complete" | "past-incomplete" | "future-locked";

function getDayState(dayNumber: number, todayIndex: number, completedCount: number, total: number): DayState {
  if (dayNumber === todayIndex + 1) return "today";
  if (dayNumber < todayIndex + 1) {
    return completedCount === total ? "past-complete" : "past-incomplete";
  }
  return "future-locked";
}
```

**Styling:**
```typescript
const dayStateStyles = {
  today: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  "past-complete": {
    borderColor: "#22c55e", // green
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  "past-incomplete": {
    borderColor: "#eab308", // yellow
    backgroundColor: "rgba(234, 179, 8, 0.1)",
  },
  "future-locked": {
    opacity: 0.4,
    borderColor: COLORS.cardBorder,
  },
};
```

**Completion Badge:**
```tsx
{state === "past-complete" && <Text style={styles.checkmark}>✓</Text>}
{state === "future-locked" && <Text style={styles.lock}>🔒</Text>}
```

**Context Line (at top of screen):**
```tsx
<Text style={styles.contextLine}>
  {getContextLine(program.version, program.scoresSnapshot)}
</Text>

function getContextLine(version: string, scores: Scores): string {
  // Determine which program based on selection logic
  const programType = determineProgramType(scores);

  if (programType === 1) return "Your program focuses on jawline and structural development";
  if (programType === 2) return "Your program focuses on eye symmetry and midface optimization";
  if (programType === 3) return "Your program focuses on skin clarity and facial refinement";

  return "Your personalized 70-day program";
}
```

**Disable Future Days:**
```tsx
<Pressable
  disabled={state === "future-locked"}
  onPress={() => {
    if (state !== "future-locked") {
      router.push({ pathname: "/program/[day]", params: { day: String(dayNumber) } });
    }
  }}
>
```

---

#### Task 2.2: Add Program Type to Store
**File:** `facely/store/program.ts`

**Add field to state:**
```typescript
type ProgramState = {
  program: Program | null;
  programType: 1 | 2 | 3 | null; // NEW
  completions: Record<string, boolean>;
  todayIndex: number;
  // ... rest
};
```

**Compute on hydrate:**
```typescript
hydrate: (resp) => {
  const programType = determineProgramTypeFromScores(resp.program.scoresSnapshot);
  set({
    program: resp.program,
    programType, // NEW
    completions: resp.completions,
    todayIndex: computeTodayIndex(...),
  });
}
```

---

### Phase 3: Tasks Screen (Day Detail) Enhancements

#### Task 3.1: Add Context Line
**File:** `facely/app/program/[day].tsx`

**Add at top of day content (after header):**
```tsx
<View style={styles.contextBanner}>
  <Text style={styles.contextText}>
    {getContextLineForDay(programType, day.phase)}
  </Text>
</View>

function getContextLineForDay(programType: 1 | 2 | 3, phase: string): string {
  const focus = {
    1: "jawline and structure",
    2: "eye symmetry and midface",
    3: "skin clarity and facial definition",
  }[programType];

  const phaseAction = {
    foundation: "building control",
    development: "progressive loading",
    peak: "refinement and stabilization",
  }[phase] || "recovery";

  return `Today's routine is optimized for your ${focus} ${phaseAction}`;
}
```

---

#### Task 3.2: Update Completion Modal (Show Confirmation)
**File:** `facely/app/program/[day].tsx`

**Current:** Modal closes immediately after completion
**New:** Shows confirmation message, stays open 1 second, then auto-closes

**Add state:**
```typescript
const [showConfirmation, setShowConfirmation] = useState(false);
```

**Update handleCompletion:**
```typescript
async function handleCompletion(exerciseId: string) {
  setSubmitting(true);
  try {
    await toggleCompletion(safeDay.dayNumber, exerciseId);
    setShowConfirmation(true); // Show confirmation

    // Auto-close after 1 second
    setTimeout(() => {
      setShowConfirmation(false);
      setSelectedId(null);
    }, 1000);
  } catch (err: any) {
    console.warn("Completion toggle failed", err);
  } finally {
    setSubmitting(false);
  }
}
```

**Update Modal content:**
```tsx
<Modal visible={!!selected && !showPlayer} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>{selected?.name}</Text>

      {showConfirmation ? (
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmationText}>✓ Exercise marked complete!</Text>
        </View>
      ) : (
        <>
          <Text style={styles.modalText}>What would you like to do?</Text>
          <View style={styles.modalActions}>
            <PillNavButton
              kind="ghost"
              label={submitting ? "Saving..." : "Task completed?"}
              onPress={() => selected && handleCompletion(selected.id)}
              disabled={submitting}
            />
            <PillNavButton
              kind="solid"
              label="Start"
              onPress={() => setShowPlayer(true)}
              disabled={submitting}
            />
          </View>
          <PillNavButton kind="ghost" label="Close" onPress={() => setSelectedId(null)} />
        </>
      )}
    </View>
  </View>
</Modal>
```

**Styling:**
```typescript
confirmationBox: {
  padding: SP[3],
  backgroundColor: "rgba(34, 197, 94, 0.1)",
  borderRadius: RADII.md,
  borderColor: "#22c55e",
  borderWidth: 1,
},
confirmationText: {
  color: "#22c55e",
  fontSize: 16,
  fontWeight: "700",
  textAlign: "center",
},
```

---

#### Task 3.3: Verify Exercise Player (Already Exists)
**File:** `facely/app/program/[day].tsx` (lines 34-77)

**Current Implementation:**
- ✅ 30-second timer with countdown
- ✅ Frame cycling (1 second per pose)
- ✅ Protocol display
- ✅ Exercise name header
- ✅ Close button

**No changes needed** - existing player matches requirements!

**Just verify:**
- Images load from `POSE_FRAMES` mapping
- Timer counts down correctly
- Frames cycle every 1 second
- Modal closes on "Close" button

---

### Phase 4: Dev Mode Regeneration

#### Task 4.1: Add Dev Button
**File:** `facely/app/(tabs)/program.tsx`

**Add in footer section:**
```tsx
<View style={styles.footerRow}>
  {__DEV__ && (
    <PillNavButton
      kind="ghost"
      label="🔄 Regenerate (Dev Only)"
      onPress={() => bootstrap(true)}
    />
  )}
</View>
```

**Logic:**
- `__DEV__` flag ensures only visible in development
- `bootstrap(true)` calls `generate()` which uses latest scan scores
- Overwrites current program

---

## Data Flow

### Program Generation Flow
```
User completes scan → Scores saved to DB
                    ↓
User opens Program tab → fetchLatest() or generate()
                    ↓
Backend: POST /programs
    1. Fetch latest scan scores
    2. Parse 3 programs from markdown
    3. Calculate gaps for all 3 buckets
    4. Select Program 1, 2, or 3 (highest gap wins)
    5. Map selected program to Program schema
    6. Save to programs table with scores_snapshot
    7. Return program + empty completions
                    ↓
Frontend: Store in Zustand
    - program: full 70-day data
    - programType: 1, 2, or 3
    - completions: { "programId:day:exerciseId": true/false }
    - todayIndex: computed from createdAt
```

### Daily Usage Flow
```
User opens Program tab
    ↓
See: 70-day grid with visual states (today highlighted, past completed/incomplete, future locked)
    ↓
Tap unlocked day → Navigate to /program/[day] (Tasks Screen)
    ↓
See: Context line ("Today's routine is optimized for your {area} recovery")
     + 5 exercises with completion badges
    ↓
Tap exercise → Completion Modal
    ↓
Choose: "Task completed?" → Shows confirmation, marks done, auto-close after 1s
     OR "Start" → Opens Exercise Player
    ↓
Exercise Player: Shows protocol, timer (30s), animation (cycling poses)
    ↓
Close player → Return to Tasks Screen
    ↓
When all 5 exercises done → Day locks, tomorrow unlocks
```

---

## Exercise Name Mapping

From `scorer-node/all-3-programs.md` to `exerciseCatalog.ts`:

| Markdown Name               | Exercise ID           |
|-----------------------------|-----------------------|
| CPS                         | cps                   |
| Thumb pulling               | thumb-pulling         |
| Chin tucks                  | chin-tucks            |
| Hunter eyes 1               | hunter-eyes           |
| Hyoid stretch               | hyoid-stretch         |
| Lymphatic drainage          | lymphatic-drainage    |
| Upward chewing              | upward-chewing        |
| Neck lift                   | neck-lift             |
| Jaw resistance              | jaw-resistance        |
| Eyes and cheeks             | eyes-and-cheeks       |
| Alternating cheek puffs     | alternating-cheek-puffs |
| Nose massage                | nose-massage          |
| Lion                        | lion                  |
| Nose touching with tongue   | nose-tongue-touch     |
| Fish face                   | fish-face             |

**Note:** Some exercises in catalog not in programs (e.g., `sternocleidomastoid-stretch`)

---

## Files to Create

1. **`scorer-node/src/program/programData.ts`**
   - Parse `scorer-node/all-3-programs.md`
   - Export `PROGRAM_1`, `PROGRAM_2`, `PROGRAM_3`

---

## Files to Modify

### Backend
1. **`scorer-node/src/program/generateProgram.ts`**
   - Add `selectProgramFromScores()` function
   - Replace algorithmic generation with selection logic
   - Update `generateProgramFromScores()` to map selected program

2. **`scorer-node/src/routes/programs.ts`**
   - No changes (uses updated generation function internally)

### Frontend
3. **`facely/app/(tabs)/program.tsx`**
   - Add visual states for day cards (today, past-complete, past-incomplete, future-locked)
   - Add context line at top (program focus)
   - Disable future days (non-interactive)
   - Add dev regenerate button
   - Keep 70-day grid layout (14 rows × 5 columns)

4. **`facely/app/program/[day].tsx`**
   - Add context line ("Today's routine is optimized for...")
   - Update Completion Modal to show confirmation message
   - Keep existing Exercise Player (no changes needed)

5. **`facely/store/program.ts`**
   - Add `programType` field (1 | 2 | 3)
   - Compute on hydrate from scores

6. **`facely/lib/programAssets.ts`** (if needed)
   - Verify `POSE_FRAMES` mapping includes all exercises
   - Update paths to `aligned_exercises` folder

---

## Testing Plan

### 1. Program Selection Logic
- **Test Case 1:** Low jawline (40) → should assign Program 1
- **Test Case 2:** Low eyes (45) + low nose (50) → should assign Program 2
- **Test Case 3:** Low skin (35) → should assign Program 3
- **Test Case 4:** Tie (equal gaps) → verify tiebreaker uses biggest single weakness
- **Test Case 5:** All scores above 80 → should still assign a program (smallest gap wins)

### 2. UI Visual States
- **Today:** Highlighted border, shadow, "Today" badge
- **Past complete:** Green border, checkmark ✓
- **Past incomplete:** Yellow border, shows "3/5 complete"
- **Future locked:** Grayed out, lock icon 🔒, not clickable

### 3. Completion Flow
- **Mark complete:** Click "Task completed?" → Shows "✓ Exercise marked complete!" → Auto-close after 1s
- **Exercise appears checked:** Returns to Tasks Screen, exercise shows green checkmark
- **Persistence:** Reload app, completion still marked
- **Toggle:** Click completed exercise again → Can unmark (if allowed)

### 4. Exercise Player
- **Timer:** Counts down from 30 to 0
- **Animation:** Cycles through pose images every 1 second
- **Protocol:** Shows full text
- **Close:** Manual close works anytime

### 5. Edge Cases
- **No scores:** Redirect to take-picture
- **Day 70 completion:** All exercises done, what happens next?
- **Regenerate:** Dev button creates new program with latest scores
- **Missing images:** Fallback image shows

---

## Implementation Sequence

**Recommended order:**
1. ✅ Create `programData.ts` (parse markdown into structured data)
2. ✅ Update `generateProgram.ts` (selection logic)
3. ✅ Test backend with Postman (verify program selection)
4. ✅ Update `program.tsx` (visual states, disable future days)
5. ✅ Update `[day].tsx` (context line, confirmation modal)
6. ✅ Add `programType` to store
7. ✅ End-to-end testing
8. ✅ Polish & edge cases

---

## Success Criteria

✅ Backend correctly parses all 3 programs from markdown
✅ Program selection logic chooses correct program based on score gaps
✅ Program tab shows 70-day grid with correct visual states
✅ Future days are locked/non-interactive
✅ Context line shows intelligent, personalized message
✅ Completion modal shows confirmation and auto-closes
✅ Exercise player works with timer and animation
✅ Dev button regenerates program from latest scores
✅ All completion tracking persists across sessions

---

## Notes

- **DO NOT break existing completion tracking** - it's already working
- **DO NOT change API contracts** - just change program generation internals
- Programs are **immutable once assigned** (until manual regeneration)
- The markdown file is the **source of truth** for all 3 programs
- Exercise images must exist in `aligned_exercises` folder with correct naming

---

## Phase 5 (Future): Minimal UX Mode

**After testing Phase 1-4**, implement the minimal cognitive load UX:

- Hide 70-day grid
- Show only: Today + Tomorrow + phase info
- Everything else hinted/blurred

This is for **production release** after testing is complete.
