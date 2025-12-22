# Program Generation Feature Plan

## Phases
1) Recon: map existing history fetch, tab layout, data stores, aligned_exercises assets, and backend routine/history routes. Confirm DB access layer (Supabase) and available auth/session handling.
2) Program logic + contracts: codify deterministic generator per PROGRAM.MD rules, define API shape for generate/read/update completion, and finalize DB schema.
3) UI & navigation: add Program entry in bottom layout, build 70-day grid, Tasks screen with exercise list, completion toggle, start modal with protocol + timer + animation loop, and missing-score redirect to face analysis.
4) Persistence & state: wire frontend to backend program endpoints, handle optimistic updates for completion ticks, cache aligned_exercises assets usage, and ensure idempotent generation per user.
5) QA & rollout: unit tests for generator and schema validation, integration tests for API routes, UI smoke, docs updates, and migration rollout plan.

### Feature requirements
- Program tab/button in bottom layout opens Program screen.
- Program screen shows 70 days (5 per row, top-to-bottom), labeled by day.
- Selecting a day opens Tasks screen listing 5 exercises selected by generator for that day.
- Exercise tap opens prompt: “task completed?” (checks off) or “start”.
- Start shows protocol, exercise name header, 30s timer, and looping pose animation (1s per pose frame).
- Program generated from latest face scores in History; if none, redirect to face analysis flow.
- Program stored in database; completion state persisted per exercise/day.

### Acceptance criteria
- Program generation follows PROGRAM.MD rules (prioritization, rotations, caps, recovery, phases).
- 70-day plan produced deterministically for given scores; no consecutive identical day combos; respects intensity caps.
- Missing history score triggers redirect to face analysis.
- Program grid renders all 70 days with correct day labels/order; Tasks screen shows exactly 5 exercises for selected day.
- Completion state persists across app restarts and device sessions.
- Timer and animation run for selected exercise; animation loops through poses until timer ends.
- API validation rejects malformed payloads; errors surfaced to user with retry/CTA.

### Edge cases
- No history scores; stale/partial history entries; scores missing some facial areas.
- Network failures during fetch/save; partial program generation failures.
- Incomplete assets (missing pose image) – fallback to placeholder.
- Exceeding intensity caps when multiple weak areas overlap; enforce cooldown/recovery substitutions.
- User tapping complete/start rapidly; double submission avoidance.
- Resume timer/animation if screen is backgrounded? (decide to reset or pause – default to reset on reopen).

### Error states
- 401 unauthenticated -> prompt login.
- 404 program not found -> offer generate CTA.
- 422 validation errors -> show inline message and avoid state changes.
- 5xx on generate/save -> show retry and preserve local state.
- Missing assets -> degrade gracefully with text-only protocol.

### API contracts
- `POST /programs`: body `{ scores: Record<string, number> }`; returns generated program with days/exercises and metadata.
- `GET /programs/current`: returns latest program for user, including completion states.
- `PATCH /programs/:id/completions`: body `{ day: number, exerciseId: string, completed: boolean }`; returns updated state.
- Auth via existing bearer/session middleware; all routes user-scoped.

### Request/response schemas
- Program payload: `{ id, createdAt, version, days: [{ dayNumber, phase, exercises: [{ id, name, category, intensity, targets, protocol, poses: string[], durationSeconds: number, order, completed }] }] }`.
- Error payloads: `{ error: string, message?: string, details?: any }`.

### Database schemas
- `programs`: id (uuid), user_id (uuid), created_at, version, scores_snapshot (jsonb), days (jsonb), metadata (jsonb).
- `program_completions`: id (uuid), program_id (uuid), day_number (int), exercise_id (text), completed (bool), completed_at (timestamp).

### Migrations
- Add `programs` and `program_completions` tables with indexes on user_id and program_id/day_number.

### Seed data
- None required; optional developer seed with sample scores/program for manual QA.

### ORM models
- If using Supabase client directly: typed accessors for programs/program_completions; otherwise lightweight data mappers.

### Validation rules
- Scores must be finite numbers; day count exactly 70; each day 5 exercises; no day duplicates; intensity caps per week; avoid disallowed same-day trios; rotation/recovery rules enforced.

### Business logic
- Deterministic program generator applying PROGRAM.MD rules (score bands, appearance rates, weekly shuffle, phase transitions, fatigue management, recovery days 7/14/etc, milestone recovery on 21/42/63).
- Completion toggling updates persisted state; optionally adjust local streak/analytics.

### Domain entities
- UserProgram, ProgramDay, ProgramExercise, PoseAsset, ScoreSnapshot.

### Service layer
- ProgramService: generateFromScores, getCurrent, save, toggleCompletion.
- AssetService: map exercise -> pose image paths/protocol text.
- ScoreService: fetchLatestHistoryScore (wrap existing history API).

### Controllers / handlers
- Express handlers for POST/GET/PATCH as above; reuse auth middleware for user scoping.

### Route definitions
- Mount under `/programs` router with auth guard; ensure consistent versioning (v1).

### Middleware
- Existing auth/requestId/timeout apply; add body validation middleware (zod).

### Auth guards
- Require authenticated user for all program routes; use existing middleware (`auth.ts`).

### Permission checks
- User can only access own program records; enforce user_id filters on all queries.

### Rate limits
- Soft limit program generation to 1 per day per user to avoid abuse; return existing program if already current.

### Idempotency logic
- Deduplicate POST by hashing scores+user and reusing existing program if generated within last N minutes; allow client idempotency-key header reuse if existing pattern.

### Background jobs
- Not required; generation is deterministic/local. If heavy, enqueue optional async job similar to `routineAsync` pattern.

### Queues
- None unless async generation needed; then reuse existing Redis queue infra.

### Cron tasks
- None initially; optional periodic cleanup of stale programs.

### Caching layer
- Optional in-memory/Redis cache keyed by user_id for latest program; short TTL to reduce DB hits.

### Cache invalidation
- Invalidate on new generation and on completion updates.

### Feature flags
- Wrap Program tab and program API in flag (e.g., `PROGRAM_V1_ENABLED`) for staged rollout.

### Environment variables
- Program flag(s); optional Redis URL for caching/queue; storage bucket base for pose assets if needed.

### Secrets handling
- No new secrets; reuse existing env handling. Keep flags in env, not code.

### Build configuration
- No special build changes; ensure assets bundled/accessible; Metro aware of aligned_exercises if needed.

### CI pipelines
- Add tests for generator and API routes to CI run; ensure migration/test DB steps included.

### Linting rules
- Follow existing ESLint/TypeScript configs; no changes anticipated.

### Formatting rules
- Prettier/TS existing; follow repo standards.

### Type definitions
- TS interfaces for Program, ProgramDay, ProgramExercise, PoseFrame, ScoreSnapshot, API responses.

### Shared interfaces
- Share Program types between frontend and backend (e.g., via shared package or `lib/types`).

### Constants
- Exercise catalog with ids, intensity level, categories, pose paths; phase thresholds; frequency caps; weekly pattern constants.

### Enums
- Phase enum (Foundation, Development, Peak); Intensity enum (High/Medium/Low); TargetArea enum; ExerciseCategory enum.

### Data normalization
- Normalize exercises by id; days store exercise ids + derived properties; map assets separately to avoid duplication.

### Frontend API hooks
- React hooks using existing API client: useProgram (fetch current), useGenerateProgram, useToggleCompletion with optimistic update.

### UI components
- ProgramGrid (70-day cards), DayCard, TasksList, ExerciseRow (with completion state), ExerciseActionModal, ExercisePlayer (protocol + timer + animation), StartButton/CompleteButton, empty-state redirect CTA.

### Layout files
- Add Program tab screen under `app/(tabs)/program.tsx` (or similar) and nested Tasks screen; integrate with existing `_layout`.

### Deep links
- Optional: `facely://program/day/:dayNumber` to open specific day; not required initially.

### Analytics events
- program_generated, program_opened, day_opened, exercise_started, exercise_completed, program_error.

### Logging
- Server logs for generation requests, validation failures, and completion updates.

### Monitoring
- Reuse existing metrics infra if present; basic counters for program generation success/failure.

### Error tracking
- Surface to existing error tracking (if any); at minimum console/reporting hooks on frontend.

### Performance implications
- Generator should be O(days) with small constant; ensure images cached; avoid rendering all modals at once.

### Memory usage
- Keep exercise assets lazy-loaded; reuse image references to avoid duplication in state.

### Cold start behavior
- On cold start, fetch current program; if missing scores redirect to analysis before generation.

### Backward compatibility
- No impact on existing tabs; adding new tab is additive; API versioned under `/programs` v1.

### Versioning strategy
- Program payload version field; allow future v2 without breaking clients.

### Rollback plan
- Feature flag to hide Program tab; revert API route registration; migrations backward compatible by leaving tables idle.

### Tests (unit)
- Generator rule tests (score bands, caps, rotation, recovery days); schema validation tests.

### Tests (integration)
- API route tests for POST/GET/PATCH with auth and DB mocked; history fetch redirect logic on frontend.

### Tests (e2e)
- Detox/Playwright: generate program from existing history, open day, mark complete, start exercise timer/animation.

### Test fixtures
- Sample score snapshots, expected generated weeks, mock pose assets.

### Mocks
- Mock history API, program API, timers, and image loader for UI tests.

### Documentation
- Update docs describing program logic and UI usage; mention recovery rules and limitations.

### README updates
- Add short section on Program feature and how to run tests/migrations locally.

### Changelog
- Add entry for Program tab + program generation.

### Migration notes
- Explain new tables, deployment order (migrations before API), and feature-flag rollout steps.
