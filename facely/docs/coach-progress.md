# Coach — Build Tracker

Plain-English status of the Coach feature. Updated as work lands.
The design and technical spec live in [coach-feature-plan.md](./coach-feature-plan.md).

**Branch:** `feat/coach`
**Last updated:** 2026-09-10

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked, waiting on Subhan

---

## Waiting on you

- [x] **Database files run.** Both `001_coach_tables.sql` and `002_coach_usage_rpc.sql`
      ran successfully on 2026-09-10. The four Coach tables and the usage counter exist.
- [x] **Railway branch confirmed: `main`.** Project `faithful-magic`, service `faccely`,
      root directory `scorer-node`, auto-deploy on push, no CI gate. Serving
      `faccely-production.up.railway.app` on port 8080.

      **Rule for this build:** all Coach work stays on `feat/coach`. Merging to `main`
      deploys to live users within minutes, with nothing checking it first. Merge only
      after Coach has been seen working on a phone, and with
      `FEATURE_COACH_ENABLED=false` set so the code ships dormant.
- [ ] **Add `FEATURE_COACH_ENABLED=false`** in Railway → `faccely` → Variables. Do this
      before any Coach code reaches `main`.
- [!] **Which icon do you tap on the iPhone 11** to open the app — the white Expo Go icon,
      or one with your own logo? Determines how Coach gets tested, and whether RevenueCat
      is silently broken in your current setup.

---

## Phase 0 — Groundwork

- [x] Feature plan written (`docs/coach-feature-plan.md`)
- [x] Existing work committed so Coach changes stay reviewable
      (`7a08045` build artifacts, `09b2bf5` Expo SDK 57 upgrade)
- [x] `feat/coach` branch created
- [x] Confirmed streaming is possible: `expo/fetch` in Expo SDK 57 returns a
      `ReadableStream` body with `getReader()`, so replies can appear word by word
- [x] Database files written (`supabase/coach/001_coach_tables.sql`,
      `002_coach_usage_rpc.sql`)
- [x] Build tracker written (this file)
- [ ] Streaming proved end to end on your actual phone

## Phase 1a — Backend foundations (done)

Everything below is written, type-checks clean, and has tests where the logic is worth
testing. None of it is wired to a live endpoint yet, and nothing is deployed.

- [x] Answer format shared by the API and the app — `src/schemas/CoachSchema.ts`
- [x] Conversation storage — `src/supabase/coachThreads.ts`
- [x] Quota accounting — `src/supabase/coachUsage.ts`
- [x] Remembered facts — `src/supabase/coachMemory.ts`
- [x] Data lookups and block builders — `src/services/coachData.ts`
- [x] The seven tools Coach can call — `src/services/coachTools.ts`
- [x] Invented-number guard — `src/services/coachNumberGuard.ts`
- [x] Settings and cost estimates — added to `src/config/index.ts`
- [x] Tests: 19 passing (`npm run test:coach` in `scorer-node`)

Two design choices worth knowing, because they are what stop Coach inventing numbers:

1. **Coach cannot supply a score.** When it shows a metric card or a chart, it picks the
   metric and writes the words; every figure is filled in from your database afterwards. A
   wrong number in a card is not something it is able to express.
2. **Its sentences are checked against what it was shown.** If it writes "your jawline is
   around 78" when the lookup returned 62, that sentence is removed before it reaches you.
   Ordinary advice numbers — "3 sets of 10", "8 hours of sleep" — are left alone.

## Phase 1b — Coach talks, using your real scan data

The first version you can open and use. Text answers, metric cards and charts, built on
numbers pulled from your own scans.

**Backend — done.**

- [x] The prompt and voice — `src/services/coachPrompt.ts`
- [x] The always-on context snapshot — `src/services/coachContext.ts`
- [x] Opening suggestions with no model call — `suggestOpeningChips`
- [x] The turn engine: model loop, tools, guard, saving, billing —
      `src/services/coachTurn.ts`
- [x] Four endpoints — `src/routes/coach.ts`, all behind login and behind
      `FEATURE_COACH_ENABLED`
- [x] Stream blockers fixed in `src/index.ts`: response compression now skips streams, and
      `/coach` gets its own longer timeout. The rate limiter needed no change — it counts
      requests, not seconds.
- [x] 34 tests passing, production build clean

**App — not started.**

- [ ] Reading the stream on the phone (`expo/fetch`)
- [ ] The floating button — draggable, snaps to the edge, remembers where you left it
- [ ] The chat sheet, message list, and input bar
- [ ] Block renderers: text, metric card, chart, suggested-question chips
- [ ] Opens with context from the screen you were on, never a blank box
- [ ] Conversation survives closing and reopening the app
- [ ] Replace the dormant Sigma prototype (see *Decisions* below)

## Phase 2 — Limits, safety and billing

Nothing ships to real users before this phase is finished.

- [ ] Weekly token budget, shown to you as "messages left"
- [ ] Daily sub-limit so a week cannot be burned in one sitting
- [ ] Locked behind the paywall, matching the rest of the app
- [ ] Cheap-model router: simple questions answered cheaply, hard ones by the strong model
- [ ] Cost tracking per user, visible to you
- [ ] Safety filter: minors, body-image distress, medical and surgical questions
- [ ] Report button on each message (App Store requires this)
- [ ] Red-team test set of 20 hostile messages, all handled correctly

## Phase 3 — Coach sees and remembers

- [ ] Reads your actual scan photos when answering
- [ ] Ad-hoc photos from the camera, with a daily cap
- [ ] Deep-dives on sub-metrics
- [ ] Remembers facts about you between conversations
- [ ] Before/after comparison card from two scans

## Phase 4 — Coach acts

- [ ] Adds exercises to your routine, with a confirm tap
- [ ] Adds protocols, with a confirm tap
- [ ] Proactive messages: after a scan, on a broken streak, weekly recap
- [ ] Unread badge on the floating button

## Phase 5 — Coach draws

- [ ] Image generation plumbing with a hard weekly cap of 2
- [ ] Your potential face at target scores
- [ ] Hairstyle and grooming preview
- [ ] Concept diagrams on a generic face, never yours
- [ ] Credit counter in the chat header

## Phase 6 — Knowledge quality

- [ ] Knowledge base drafted from your existing exercise and protocol catalogs
- [ ] Every claim tagged: proven, plausible, or unproven
- [ ] Coach cites which tier a claim belongs to
- [ ] You review the claims

---

## Decisions already made

| Question | Answer |
| --- | --- |
| Who gets Coach | Everyone past the paywall. No free tier. |
| Weekly limits | 2 images, and a token budget that works out to roughly 12–20 messages |
| Budget | Under 15% of the $4/week subscription. Estimated at 3–8%. |
| Cost strategy | Cheap model for simple turns, strong model for real coaching |
| Reply length | Capped short — cheaper and better to read |

## Decisions still open

- **Sigma.** The backend already has a chat prototype at `/sigma` (in-memory only, user id
  hardcoded to `"anon"`, switched off unless `FEATURE_SIGMA_ENABLED` is set). The app screen
  `app/sigma.tsx` exists but nothing links to it. Recommendation: Coach replaces it, reusing
  its prompt and chip ideas, and the dead Sigma code is deleted once Coach works. Needs your
  yes before anything is removed.
- **Coach's voice.** Sigma's prompt is heavy gym-bro ("bro", "king", "no cap"). Coach's plan
  calls for a direct, honest, no-hype voice. Pick one before the prompt is written.

## Things worth knowing

- The branch name `upgrade/expo-sdk-54` is out of date — the app is on Expo SDK 57.
- `scorer-node/fly.toml` is leftover config for a Fly.io app that is not in use. The live API
  runs on Railway.
- `facely/.tmp/index.bundle.js` (462,814 lines of build output) had been committed by
  mistake. Removed, and now ignored.
