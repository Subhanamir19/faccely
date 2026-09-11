# Coach — In-App AI Assistant (Feature Plan)

Status: proposal / not started
Owner: TBD
Last updated: 2026-09-10

A conversational, multimodal assistant embedded in SigmaMax. It answers looksmaxxing
questions, but its real differentiator is that it already knows the user's scan history,
submetrics, routine adherence and goals — and it can act on the app on the user's behalf.

---

## 1. Positioning — a coach with your file open, not a chatbot

Avoid the blank "ask me anything" box. A blank box means the user asks nothing and the
feature dies in week two.

The assistant should open with context rather than a greeting:

- Bad: "Hi! How can I help?"
- Good: "Jawline 62, down 3 since Aug 14. Want me to show why?" plus three tappable chips.

Every session is pre-seeded from the current screen and the latest scan. A zero-typing path
must always exist.

## 2. Core principle — chat that changes the app

An answer-only chatbot is a commodity. The differentiator is that Coach writes as well as
reads:

- "my cheekbones look flat" → explains, then offers to add two exercises to today's routine
  (single confirm tap)
- "I sleep 5 hours" → offers to add the sleep protocol and set a reminder
- "compare me to three months ago" → renders a before/after card from real scan photos

Over time chat becomes a primary control surface for the whole app. That is the signature,
not the prose quality.

## 3. Output contract — the model emits blocks, the app renders native components

Do not stream markdown and render markdown. It looks like a web page inside a premium
native app.

The model emits typed blocks (via tool calls); the app maps each block to a React Native
component:

| Block | Renders as |
| --- | --- |
| `text` | short copy, 2–4 lines max, enforced by the system prompt |
| `metric_card` | metric, score, delta, verdict color (reuse `lib/verdictColor.ts`) |
| `chart` | line / radar / bar — data always comes from a tool, never from model tokens |
| `compare` | two scan IDs, photo slider plus delta list |
| `table` | max 4 columns, mobile-first |
| `action_card` | exercise or protocol ID plus an "Add to routine" button |
| `image` | generated image, quota-gated |
| `chips` | up to 3 suggested follow-up questions (main engagement driver) |
| `citation` | claim plus evidence tier |

Hard rule: **the model must never type a number it did not receive from a tool.** A
hallucinated score destroys trust in the scan pipeline itself. Enforce mechanically — a
server post-pass extracts digits from `text` blocks and checks each against the tool result
set. On mismatch, strip the sentence and log `coach_number_hallucination`.

## 4. Context engine — tools, not context stuffing

Do not dump the full history into the system prompt. Use two layers.

**Layer A — cheap always-on prefix** (~500 tokens, prompt-cached): age, gender, goals,
latest 7 scores, streak, subscription tier, active routine, top two weak metrics.

**Layer B — tools on demand** (server-side function calling):

- `get_scan_history(metric?, range)`
- `get_submetrics(scanId)` — cheekbones ×4, jawline ×3, eyes ×4, skin ×2
- `get_routine_adherence(days)` — whether the user actually did the work
- `get_potential_face()`
- `get_scan_photo(scanId, view)` — feeds vision
- `search_knowledge(query)` — RAG over the curated corpus
- `generate_image(kind, params)` — quota-checked
- `add_task(exerciseId)` / `add_protocol(id)` — writes, require a user confirm tap
- `emit_chart(spec)`

The tool layer is where competence lives. More tools means more "how did it know that"
moments.

## 5. Persistent user memory

Separate from scan data. Extract facts from conversation, store them in Supabase, and inject
them into Layer A: age 19, braces until 2027, low budget, goal is jawline for photos, tried
mewing for three months, dislikes long skincare routines.

Cap at roughly 20 facts with LRU eviction. This is what makes the month-two conversation
feel personal. Cheap to build, high payoff.

## 6. Vision input

Keep two input paths separate:

- **Scan photos** — already on the server, high quality, standardized pose. Use these by
  default: "look at my last scan and tell me about my nose."
- **Ad-hoc camera photos** — hairstyle check, product photo, angle test. Cap at 3/day free
  and 20/day for Pro. Downscale to 768px before upload.

Never let an ad-hoc photo write scores. Scores come only from the scan pipeline, otherwise
metric integrity is gone.

## 7. Image generation — rare, expensive, magical

Not a general-purpose toy generator. Three high-value kinds only:

1. **Potential-face render** — the user at their target metrics. Ties into the existing
   `potentialFace` store. Highest emotional payload in the app.
2. **Hairstyle / grooming try-on** — different cut or beard shape. The `haircut` advanced
   metric already ships.
3. **Concept diagram** — e.g. "what is gonial angle", drawn on a generic face, never the
   user's.

Quota: free tier 0 (blurred teaser plus paywall), Pro 3/day. Show a credit counter in the
chat header so scarcity reads as intentional rather than broken.

Guardrail: never generate an "improved you" that implies a surgical outcome. Only deltas
achievable through exercise, grooming and skin care. This is both a legal and an App Store
review risk.

## 8. Knowledge layer

Do not rely on the base model's looksmaxxing knowledge — it is inconsistent and
forum-sourced.

Build a curated corpus of roughly 200–400 chunks from our own protocol catalog, exercise
catalog and submetric definitions. Tag every chunk with an evidence tier: proven, plausible,
or bro-science. The model must cite the tier.

This creates a defensible voice: "mewing — plausible, no controlled trials; jaw fat loss —
proven, driven by body fat." Competitors claim everything works. Honesty is the brand.

## 9. Floating orb UX

- Draggable, snaps to the nearest edge, remembers its position per screen.
- Idle state is small and low-opacity. It must never cover a primary CTA — maintain a
  per-screen collision list.
- Contextual badge pulses when it has something to say on that screen ("new scan
  explained", "3 days without a routine").
- Long-press exposes quick actions without opening the full chat.
- Opening presents a 90% bottom sheet rather than a full screen, so the user keeps
  orientation.
- Hidden during camera, scan loading, onboarding and paywall.

Treat the orb as top-level navigation, not a widget. It is eventually the entry point to the
whole product.

## 10. Proactive layer — the retention engine

Reactive chat gets used once a week. Proactive messaging makes it daily.

Triggers:

- scan completes → "Symmetry moved +4. Here's what changed." plus a chart
- streak breaks for 2 days → a check-in, not a scolding
- weekly Sunday recap → chart plus one focus for the coming week
- metric regression → diagnostic questions

Deliver as an unread badge on the orb plus an optional push. Cap at one per day. Reuse
`store/notifications.ts`.

## 11. Safety — ships in v1, not later

The product category is body image. The risk is real and App Store reviewers look for it.

- Detect minors and soften; no attractiveness-ranking framing.
- Detect dysmorphia or self-harm language; break character, use a supportive script with
  resources, and stop metric talk.
- Never rank a user comparatively against other users.
- Never recommend surgery. Explaining what a procedure is, is fine; "should I get it" is
  refused.
- Run a moderation pass over both user input and model output using a cheap classifier
  model.
- Provide a report button on each message (App Store UGC requirement).
- Show the disclaimer once per session, not per message.

## 12. Cost and technical architecture

- All LLM calls stay server-side on Railway (`https://faccely-production.up.railway.app`).
  No API key in the app. The project already uses `openai ^6.0.1`.
- **Router pattern**: a small fast model classifies intent and selects tools; the large model
  runs only for coaching and synthesis. Expect a 60–70% cost reduction.
- Prompt caching on the Layer A prefix.
- Per-user daily token budget. Free: 10 messages/day. Pro: 200/day soft cap. Show the
  remaining count.
- Store the conversation server-side, not only in Zustand — needed for cross-device sync and
  for memory extraction.
- New `store/coach.ts` holds UI state only; the transcript is paginated from the server.
- Degradation: if tools are slow, stream the text first and backfill the chart block.

## 13. Build order

1. **v1** — orb plus sheet, `text` / `metric_card` / `chart` over real scan data, five tools,
   chips, safety. This alone is signature-grade.
2. **v2** — vision over scan photos, submetric deep-dives, persistent memory.
3. **v3** — write actions (add task / add protocol), proactive triggers.
4. **v4** — image generation (potential face, hairstyle).

Ship v1 narrow and polished. A chat that hallucinates a single score does more damage than
no chat at all.

## 14. Biggest risks

- **Blank-box death** — solved by pre-seeded context and chips.
- **Markdown look** — solved by the native block renderer.
- **Hallucinated numbers** — solved by tool-only numbers plus server validation.
- **Cost blowout** — solved by the router, caching and caps.
- **Generic knowledge** — solved by the curated corpus with evidence tiers.

---

# v1 Implementation Spec

## 15. Naming and surface

Use one name everywhere, including in code: **Coach**. Avoid "AI" in user-facing labels — it
reads generic.

Routes: `app/coach.tsx` presented as a modal from `app/_layout.tsx`. The orb mounts in
`app/_layout.tsx`, above the router and below modals.

## 16. File map

```
app/coach.tsx                        modal route, hosts the thread
components/coach/CoachOrb.tsx        draggable bubble
components/coach/CoachSheet.tsx      sheet shell plus input bar
components/coach/Thread.tsx          message list, autoscroll
components/coach/blocks/             one file per block type
  TextBlock.tsx  MetricCardBlock.tsx  ChartBlock.tsx
  CompareBlock.tsx  TableBlock.tsx  ActionCardBlock.tsx
  ImageBlock.tsx  ChipsBlock.tsx  BlockRenderer.tsx
lib/api/coach.ts                     streamCoach(), sendFeedback()
lib/coach/blocks.ts                  zod schemas and types
lib/coach/context.ts                 builds the Layer A client-side hints
store/coach.ts                       thread UI state, orb position, quota
```

Reuse rather than rebuild: `components/ui/MetricCard.tsx`, `components/ui/GlassCard.tsx`,
`lib/verdictColor.ts`, the error classes in `lib/api/client.ts`, and `lib/haptics.ts`.

## 17. Block schema (`lib/coach/blocks.ts`)

Validate every block with zod on both the server and the client. An unknown block type is
skipped silently and must never crash the thread.

```ts
type Block =
  | { type: "text"; md: string }                    // inline bold/italic only
  | { type: "metric_card"; metric: MetricKey; score: number;
      delta?: number; note: string }
  | { type: "chart"; chart: "line" | "radar" | "bar";
      series: { label: string; points: { x: string; y: number }[] }[];
      yMin?: number; yMax?: number; caption?: string }
  | { type: "compare"; beforeScanId: string; afterScanId: string;
      deltas: { metric: MetricKey; from: number; to: number }[] }
  | { type: "table"; headers: string[]; rows: string[][] }  // <= 4 columns
  | { type: "action_card"; action: "add_exercise" | "add_protocol";
      id: string; title: string; reason: string }
  | { type: "image"; url: string; kind: "potential" | "hairstyle" | "concept";
      creditsLeft: number }
  | { type: "chips"; items: string[] }              // <= 3
  | { type: "citation"; claim: string;
      tier: "proven" | "plausible" | "unproven" };
```

`MetricKey` is the existing set of 7 metric keys — import it from `lib/types.ts`, do not
redeclare it.

## 18. Wire protocol

NDJSON over `expo/fetch` streaming (Expo SDK 54). One JSON object per line. Simpler than SSE
and needs no extra dependency — `react-native-sse` is not installed.

```
{"t":"start","messageId":"..."}
{"t":"delta","i":0,"text":"Jawline is "}      // partial text block
{"t":"block","i":1,"block":{...}}             // complete non-text block
{"t":"tool","name":"get_scan_history"}        // UI shows "reading your scans"
{"t":"done","usage":{"in":812,"out":240},"quota":{"left":7}}
{"t":"error","code":"quota_exceeded"}
```

Text streams token by token for perceived speed. Structured blocks arrive whole — never
render half a chart.

Surface the tool events in the UI. "Reading your scans…" is the proof that it actually knows
the user; hiding it wastes the effect.

## 19. Tool schemas (server side, OpenAI function calling)

Keep the tool count under ten in v1 — more tools means worse selection.

```
get_scan_history(metric?: MetricKey, limit: number = 6)
  -> { scanId, date, scores: Record<MetricKey, number> }[]

get_submetrics(scanId?: string)         // defaults to the latest scan
  -> { parent: MetricKey, key, label, score }[]

get_routine_adherence(days: number = 14)
  -> { completedDays, totalDays, streak, missedExercises: string[] }

get_profile()
  -> { age, gender, goals[], ethnicity, tier, memoryFacts[] }

search_knowledge(query: string, k: number = 5)
  -> { chunk, tier, source }[]

emit_chart(chart, series, caption?)     // renders only; invents no data
emit_action(action, id, reason)
```

Expose `emit_*` as tools rather than free-text JSON. That forces valid structure — the model
cannot malform a chart.

## 20. Prompt architecture

Three fixed segments in this order, so that the cacheable prefix comes first:

1. **System — persona and rules** (static, ~900 tokens, cached). Voice is direct: no hype, no
   "great question". Max three sentences per text block. Every reply ends with a chart, an
   action or chips — never a dead end.
2. **Layer A context** (semi-static per session, cached): profile, latest scores, streak,
   active routine, top two weak metrics, memory facts.
3. **Turn**: the screen the orb was opened from, the last 8 messages, the user's text.

Screen context is free intelligence. If the orb opens on `app/analysis.tsx` while the user is
viewing cheekbones, the default question is about cheekbones.

## 21. Router — cost control

Turn 1: a mini-class model classifies intent into `{ intent, tools[], needsBig: bool }`.

- `smalltalk`, `definition`, `nav_help` → answered by the small model directly (expect ~70%
  of traffic)
- `diagnosis`, `plan`, `compare`, `vision` → large model with preselected tools

Log the intent distribution from day one; it tunes the split with real data.

## 22. Orb mechanics

Dependencies are already present: `react-native-reanimated@4.5.1`,
`react-native-gesture-handler@~2.32.0`, `react-native-svg@15.15.4`.

- Reanimated shared values with `Gesture.Pan()`, running on the UI thread.
- Snap with `withSpring` to the nearest horizontal edge on release. Clamp Y to the safe area
  plus the tab bar height.
- Persist `{ x, y }` per route key in `store/coach.ts` via `lib/storage.ts`.
- States: idle (0.75 opacity, 52px) → active (1.0, subtle pulse) → unread (dot badge).
- Auto-dim after 4 seconds without interaction.
- Hidden routes: `take-picture`, `loading`, the onboarding stack, and the paywall.
- Long-press reveals three radial quick actions: "Explain my last scan", "What should I do
  today", "Ask".
- Haptics on grab and on snap.

For the sheet, adding `@gorhom/bottom-sheet` is worth the dependency — drag-to-dismiss and
keyboard handling are where hand-rolled sheets fail.

## 23. Telemetry

Log per message: intent, tools used, latency to first token, total latency, tokens in/out,
blocks emitted by type, chip-tap versus typed input, action_card accept rate, thumbs up/down.

Two metrics decide whether this is signature-grade:

- **D7 chat retention** — the share of scanners who open Coach in week two
- **action_card accept rate** — proof it changes behavior rather than just answering

If the accept rate is below 15%, the reasoning is too generic. Fix the corpus, not the UI.

## 24. v1 acceptance criteria

- First token under 1.2s at p50 on 4G
- Zero unvalidated numbers in text blocks, checked by an automated server test
- Every reply ends with a chart, an action, or chips
- The thread survives backgrounding and a cold start
- The orb never overlaps a primary CTA on any of the 12 main screens
- The safety classifier blocks all 20 items in a red-team fixture set before ship

## 25. Open decisions

1. **Per-message LLM budget** — determines the model tier and whether the router is required
   at launch. Recommendation: build the router from day one; retrofitting it is painful.
2. **Free-tier access** — a 3-messages/day teaser, or Pro-only. The teaser converts better
   but costs real money across a free user base.
3. **Corpus authorship** — who writes the 200–400 knowledge chunks with evidence tiers. This
   is the real bottleneck, not the code. Start it in parallel with the v1 build.

## 26. Relationship to the existing Sigma prototype

The backend already contains a chat feature. It was found after this plan was written and it
changes the build approach.

What exists today:

- `src/routes/sigma.ts` — `POST /sigma/thread`, `GET /sigma/thread/:id`, `POST /sigma/message`
- `src/services/sigmaPrompt.ts` — system prompt with scores and routine-day context,
  guardrails against medical claims, and an instruction to end with 2–3 tappable follow-up
  chips
- `src/services/sigmaOpenAI.ts` — a thin OpenAI wrapper with a response byte cap and chip
  extraction
- `src/schemas/SigmaSchema.ts` — thread and message zod schemas
- `facely/app/sigma.tsx`, `store/sigma.ts`, `lib/api/sigma.ts` on the app side

Why it is not production-ready:

- Threads live in an in-memory `Map`, so every server restart erases them
- `user_id` is hardcoded to `"anon"` — messages are not tied to a real account
- Gated off behind `FEATURE_SIGMA_ENABLED`, and nothing in the app navigates to
  `app/sigma.tsx`, so it is unreachable
- Plain text replies only: no tools, no charts, no quota, no vision, no safety classifier

Coach is the production version of this idea, not a parallel system. Reuse what is sound —
the chip convention, the guardrail list, the prompt's context-injection shape, the OpenAI
config keys in `PROVIDERS.openai` — and replace the rest. Once Coach works end to end, delete
the Sigma route, services, schema, store and screen so the repo holds one chat feature rather
than two.

The one thing to decide deliberately is voice. Sigma's prompt is heavy gym-bro ("bro",
"king", "no cap"). This plan calls for a direct, evidence-honest voice with no hype. They are
incompatible; pick one before the Coach prompt is written.
