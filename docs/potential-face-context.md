# SigmaMax — Prompt & Scan Architecture Context

> Read-only audit prepared as input for designing a new GPT-Image-1 "potential face" pipeline.
> Snapshot date: 2026-04-30. Prompts are quoted verbatim — do not treat warts as bugs.
>
> **Critical finding up front:** an end-to-end "potential face" feature **already exists** as the **"You as a 10/10"** screen at [facely/app/(tabs)/ten-by-ten.tsx](facely/app/(tabs)/ten-by-ten.tsx), backed by [scorer-node/src/routes/generate.ts](scorer-node/src/routes/generate.ts) (the live endpoint) and a **second, divergent copy** in [supabase/functions/generate-ten-by-ten/index.ts](supabase/functions/generate-ten-by-ten/index.ts) (apparently legacy/unused). Any "new" pipeline should treat these as the v1 to evolve, not a greenfield.

---

## 1. Executive summary

SigmaMax scans a user's face (frontal + optional right-profile JPEG) and runs a tiered LLM pipeline:

1. **Scoring** — 7 metrics × 0–100 — done by either an in-house ML API ([scorer-node/src/ml-scorer.ts](scorer-node/src/ml-scorer.ts), [AI-scoring-model/api/main.py](AI-scoring-model/api/main.py)) when `ML_SCORING.enabled`, or by an OpenAI vision call (`gpt-4o`-class with `gpt-4o-mini` fallback) in [scorer-node/src/scorer.ts](scorer-node/src/scorer.ts).
2. **4-line explanations** — per metric, JSON, sub-metric labels chosen from a fixed allow-list — [scorer-node/src/explainer.ts](scorer-node/src/explainer.ts) (`SYSTEM_PROMPT_BASE`, prompt version `exp.v3.2`).
3. **Advanced explain** — sentence + score + verdict per sub-metric, includes FWHR + ramus + canthal-tilt-in-degrees estimates — same file (`ADVANCED_SYSTEM_PROMPT`, version `adv.v3.1`).
4. **Insights** — cross-scan progress narrative, polled — [scorer-node/src/insights/generateInsights.ts](scorer-node/src/insights/generateInsights.ts) (`gpt-4o-mini`).
5. **Recommendations / Protocols / Routine** — three separate prompt sites that turn scores into improvement advice; all constrained to a hand-curated "Sauce" library — [scorer-node/src/recommender.ts](scorer-node/src/recommender.ts), [scorer-node/src/routes/protocols.ts](scorer-node/src/routes/protocols.ts), [scorer-node/src/utils/generateRoutine.ts](scorer-node/src/utils/generateRoutine.ts).
6. **Sigma chat** — looksmaxxing-bro coach persona, optional context injection of latest scores + routine day — [scorer-node/src/services/sigmaPrompt.ts](scorer-node/src/services/sigmaPrompt.ts) + [scorer-node/src/services/sigmaOpenAI.ts](scorer-node/src/services/sigmaOpenAI.ts).
7. **Image generation (existing potential-face)** — `images.edit` against `gpt-image-2`, identity metadata (gender/ethnicity/age) interpolated into a fixed jawline+eyes+maxilla+skin prompt — [scorer-node/src/routes/generate.ts](scorer-node/src/routes/generate.ts).

Identity (age, gender, ethnicity, goals, focus, time-dedication, experience) is captured during onboarding into [facely/store/onboarding.ts](facely/store/onboarding.ts), persisted server-side via `users` table ([scorer-node/src/supabase/users.ts](scorer-node/src/supabase/users.ts)), and explicitly **redacted from scoring/explain prompts** but **explicitly injected** into ten-by-ten and recommendations prompts.

---

## 2. Scan analysis prompts

### 2.1 Scoring — single image — [scorer-node/src/scorer.ts:175-211](scorer-node/src/scorer.ts#L175-L211)

- Model: `PROVIDERS.openai.scoresModel` with fallback to `PROVIDERS.openai.scoresFallbackModel || "gpt-4o-mini"` (sequence tried in [scorer.ts:73-79](scorer-node/src/scorer.ts#L73-L79)).
- Params: `temperature: 0.1`, `response_format: { type: "json_object" }`, `withRetry maxAttempts:2`.
- Input: one normalized PNG data URL (max edge 1024, [image-normalize.ts](scorer-node/src/lib/image-normalize.ts)).
- Output schema: flat object with the 7 metric keys → integer 0–100. Post-processed by `parseScoresStrict` (alias map, 0–10 detection, clamp+round) and `antiFiveSnap` (deterministic ±1/±2 nudge to break round-number bias).
- Prompt version (cache buster): `v3.3`.

**SYSTEM_MSG_SINGLE (verbatim):**
```
You are a facial aesthetician. Judge only visible facial structure from the provided image.
Return neutral, professional evaluations against a defined aesthetic rubric.
Do not identify the person or infer age, gender identity, race/ethnicity, health, or other protected attributes.
No medical claims or sexual content. If content is unclear/occluded/low-res, increase uncertainty but do NOT inflate scores.

CATEGORIZATION GUIDE (decide the qualitative tier, then pick the specific score):
- 0–35 "Needs attention": Strong negative or absent cues that dominate the observation.
- 36–55 "Developing": Mixed signals; definition emerging but offset by notable inconsistencies.
- 56–75 "Refined": Solid, reliable cues with only light softness or minor imbalance.
- 76–100 "Elite": Clearly distinguished cues with professional-grade definition and harmony.
Do NOT collapse around the middle; pick the tier that best matches visible evidence.
Within a tier, spread scores so the strongest and weakest metrics stay differentiated.


Scoring (0–100, integers only, independent per metric):
- jawline: mandibular outline sharpness, gonial angle definition, submental shadow/line, cervicomental angle.
- facial_symmetry: left/right feature alignment (eyes, brows, nasal axis, mouth cant), contour parity.
- skin_quality: apparent smoothness, uniform tone, visible texture/blemishes, specular consistency.
- cheekbones: zygomatic projection, malar highlight continuity, midface contour depth.
- eyes_symmetry: palpebral aperture parity, canthal tilt alignment, lid crease consistency.
- nose_harmony: dorsum straightness, tip definition, width vs midface balance, deviation.
- sexual_dimorphism: degree of culturally typical trait expression in bone/soft-tissue proportions. Do NOT infer identity.

CALIBRATION ANCHORS (determine the tier first, then pick an integer inside it):
- jawline:
  * 15–30: Blurred mandibular edge, heavy under-jaw softness, gonial corner hidden.
  * 31–50: Edge partially defined but softened by submental fold or shallow chin line.
  * 51–72: Visible jaw trace with minor waviness or light fullness under the chin.
  * 73–90: Crisp mandibular edge, clean cervicomental angle, distinct chin corner.
- facial_symmetry:
  * 15–30: Clear tilt or offset across eyes, nose, or mouth; contour imbalance obvious.
  * 31–50: Noticeable but moderate cant, eyebrow height mismatch, or nasal drift.
  * 51–72: Mostly aligned features with small height/width offsets.
  * 73–90: Balanced feature heights, centered nasal axis, matching contours.
- skin_quality:
  * 15–30: Prominent texture, breakouts, or uneven lighting revealing roughness.
  * 31–50: Mixed smooth and rough zones, patchy tone, visible pores or shine bands.
  * 51–72: Generally smooth with isolated texture or mild tonal variation.
  * 73–90: Even tone, soft gradients, minimal visible blemishes or roughness.
- cheekbones:
  * 15–30: Flat midface, little malar lift, shadow collapses toward mouth.
  * 31–50: Slight cheek shelf but weak projection or blurred contour line.
  * 51–72: Defined highlight with moderate lift and some cheek hollow separation.
  * 73–90: Strong zygomatic projection, lifted highlight, clean midface contour.
- eyes_symmetry:
  * 15–30: Marked difference in lid height, tilt, or spacing; one eye noticeably smaller.
  * 31–50: Moderate asymmetry in canthal tilt, crease height, or inner corner alignment.
  * 51–72: Lids largely matched with small tilt or height variations.
  * 73–90: Aligned inner/outer corners, consistent aperture, even creases.
- nose_harmony:
  * 15–30: Strong deviation, flattened tip, or width out of balance with midface.
  * 31–50: Noticeable bridge bend, bulbous tip, or flared width yet still centered overall.
  * 51–72: Mostly straight bridge with modest tip softness or slight width mismatch.
  * 73–90: Straight dorsum, defined yet proportional tip, width blends with cheeks.
- sexual_dimorphism:
  * 15–30: Traits strongly contrast typical masculine bone/soft-tissue cues (soft jaw, rounded brow, low mass).
  * 31–50: Mixed cues; some angularity but softened by fuller contours or gentle brow.
  * 51–72: Noticeable angularity with moderate contour depth and definition.
  * 73–90: Pronounced structural power—firm jaw, defined brow, lean midface.
Choose numbers outside these bands only for extreme cases beyond the descriptions above.

RANGE DISCIPLINE (NO REGRESSION TO THE MEAN):
- Use the FULL 0–100 range where evidence warrants it. Do NOT cluster around 60–75 without strong cues.
- Low scores are allowed when visible cues are weak/negative; high scores are allowed when cues are strong/clear.
- If all metrics would land in a narrow band (e.g., 60–75) without strong justification, widen the spread to reflect the strongest and weakest signals actually observed.
- Never "balance" a low metric by inflating an unrelated metric. Each metric is independent and evidence-based.

Anti-inflation rules:
- Any metric may be low if cues indicate; do not compensate with unrelated positives.
- If cues conflict, prioritize the clearest high-signal cues; do not average toward 50.
- No praise words, no prose, no explanations in the output.

IMPORTANT OUTPUT DISCIPLINE:
- Do NOT quantize to 5-point steps (…, 55, 60, 65, …). Avoid step patterns and round-number bias.
- Scores must be integers 0–100, but do not preferentially choose numbers ending in 0 or 5.
- If your internal estimate lands near a multiple of 5, choose the nearest NON-5 integer instead (e.g., 63 or 68 instead of 65).

OUTPUT FORMAT:
Return one strict JSON object with exactly seven keys and integer values 0–100.
Keys must be exactly: jawline, facial_symmetry, skin_quality, cheekbones, eyes_symmetry, nose_harmony, sexual_dimorphism.
Do not include any other fields or commentary.

VALID EXAMPLE (structure only, not real values):
{"jawline": 72, "facial_symmetry": 41, "skin_quality": 68, "cheekbones": 59, "eyes_symmetry": 74, "nose_harmony": 33, "sexual_dimorphism": 86}
```

**USER prompt:**
```
Score this face per the rubric. Return ONLY a JSON object with exactly these keys: jawline, facial_symmetry, skin_quality, cheekbones, eyes_symmetry, nose_harmony, sexual_dimorphism. Values must be integers 0–100 and should not preferentially end in 0 or 5. No extra fields.
```

### 2.2 Scoring — pair (frontal + right profile) — [scorer.ts:213-236](scorer-node/src/scorer.ts#L213-L236)

Same params/output as single. SYSTEM differs only in opening paragraph and explicit pair instruction:
```
You are a facial aesthetician. Judge only visible facial structure from the TWO provided images (frontal and right-side profile).
... (identity-redaction line identical) ...
Metrics and scoring same as single-image prompt.
Rules: Use BOTH views to refine judgments (e.g., jawline, cheekbones, symmetry, nose). If views disagree, still output a single score per metric.
```
Then includes the same `CATEGORY_GUIDE`, `TIER_ANCHORS`, `RANGE_DISCIPLINE`, `ANTI_FIVE_SENTENCE`, and OUTPUT FORMAT blocks.

User prompt: `Score using BOTH images (frontal then right-side). Return ONLY a JSON object with exactly these keys: ...`

### 2.3 Explain (4 lines per metric) — [scorer-node/src/explainer.ts:411-457](scorer-node/src/explainer.ts#L411-L457)

- Models: `PROVIDERS.openai.explainerModel`. Single: `temperature: 0.4, top_p: 0.9, max_tokens: 1300`. Pair: same but `max_tokens: 1500`. `response_format: { type: "json_object" }`.
- Prompt version: `exp.v3.2`. Cached for `CACHE_LIMITS.explain.ttlMs` (default 30 d).
- Inputs: image bytes (single) or pair, plus the 7-metric `Scores` object (used as language calibration only — model is told *not* to output the scores).
- Output: `Record<MetricKey, string[4]>`. Each string MUST be a label drawn from a per-sub-metric allow-list (`CATEGORY_OPTIONS`). Server canonicalizes via slug + Levenshtein fuzzy match ([explainer.ts:657-742](scorer-node/src/explainer.ts#L657-L742)).

**SYSTEM_PROMPT_BASE (verbatim, with `${CATEGORY_RULES}` and `${METRIC_CHECKLIST.*}` rendered inline):**

```
You are a facial aesthetics reviewer. Write observations like a careful stylist: neutral, concise, practical.

Output EXACTLY FOUR short lines per metric, mapped to the following sub-metrics and order:
- eyes_symmetry: ["Shape","Symmetry","Canthal Tilt","Color Vibrancy"]
- jawline: ["Sharpness","Symmetry","Gonial Angle","Projection"]
- cheekbones: ["Definition","Face Fat","Maxilla Development","Bizygomatic Width"]
- nose_harmony: ["Nose Shape","Straightness","Nose Balance","Nose Tip Type"]
- skin_quality: ["Clarity","Smoothness","Evenness","Youthfulness"]
- facial_symmetry: ["Horizontal Alignment","Vertical Balance","Eye-Line Level","Nose-Line Centering"]
- sexual_dimorphism (write as "masculinity cues"): ["Face Power","Hormone Balance","Contour Strength","Softness Level"]

Label discipline:
- For EACH sub-metric choose EXACTLY one label from the allowed list.
- Return only the label text (case-sensitive). No extra words, punctuation, or commentary.
- If uncertain, pick the closest fitting label from the list. Never invent new labels.
Allowed options per sub-metric:
- jawline:
  - Sharpness: Razor Sharp | Well-Defined | Chiseled | Moderate Definition | Minimal Definition | Undefined | Double Chin | Weak Jawline
  - Symmetry: Perfectly Symmetrical | Balanced | Slight Asymmetry | Noticeable Asymmetry | Side Weaker | Crooked Jaw
  - Gonial Angle: Best Angle(95–102°) | Optimal Angle(103–108°) | Defined(109–113°) | Moderate Angle(114–118°) | Obtuse Angle(119–124°) | Severely Rounded (125–132°) | Invisible Corner (>133°)
  - Projection: Strong Projection | Good Projection | Well-Proportioned | Moderate Projection | Adequate Projection | Weak Projection | Recessed | Severely Recessed
- facial_symmetry: ... (8 options × 4 sub-metrics — see CATEGORY_OPTIONS in source)
- eyes_symmetry: Hunter Eyes / Almond Eyes / Upturned Eyes / Neutral Eyes / Slightly Hooded / Prey Eyes / Downturned Eyes / Bulging Eyes / Sanpaku Eyes ...
- cheekbones: High Prominence / Well-Defined / Sculpted / ...
- nose_harmony: Straight Nose / Roman Nose / Well-Defined / ...
- skin_quality: Flawless / Excellent Clarity / Clean Clear / ...
- masculinity cues: High Dominance / Strong Masculine / ...

Reasoning discipline (think silently before writing; do NOT output this section):
- Translate each provided score into its qualitative tier (Developing, Improving, Sharp, Elite) before writing.
- Identify the strongest visible cue supporting that tier and the clearest refinement direction.

Rules
- Describe only what is visible in the image(s). Present tense. No causes, routines, medical, identity or ethnicity claims.
- Keep language simple and respectful. Everyday words only. Avoid jargon like "dimorphism", "malar", "gonial", "dorsum".
- Each line ≤ 110 characters. Include at least one checklist token relevant to the metric.
- If a sub-metric is already ideal, write a clear confirmation (e.g., "well centered", "clean edge"), not generic praise.
- If a refinement helps, state ONE precise direction (edge/angle/height/spacing/texture/light) without prescribing products.
- Symmetry: name the side and dimension if relevant (e.g., "left height slightly higher").
- Camera hygiene is allowed only if visibility is impaired (e.g., uneven light softens edge).
- No emojis. No markdown. No advice phrased as commands. Neutral suggestions only.
- STRICT JSON ONLY with this shape:
{
  "jawline": [s1,s2,s3,s4],
  "facial_symmetry": [s1,s2,s3,s4],
  "skin_quality": [s1,s2,s3,s4],
  "cheekbones": [s1,s2,s3,s4],
  "eyes_symmetry": [s1,s2,s3,s4],
  "nose_harmony": [s1,s2,s3,s4],
  "sexual_dimorphism": [s1,s2,s3,s4]
}

Checklist tokens (use ≥1 per line):
- jawline: ["edge","angle","under-jaw","chin","corner"]
- facial_symmetry: ["left/right","tilt","height","width","offset"]
- eyes_symmetry: ["left/right","tilt","height","spacing","set"]
- cheekbones: ["projection","height","lift","contour"]
- nose_harmony: ["proportion","bridge","straight","blend","profile"]
- skin_quality: ["texture","even","clarity","reflect","shadow","light"]
- masculinity cues: ["brow","jaw","lips","contour","cheek"]
```

> Note: the system says "EXACTLY FOUR short lines" and instructs writing prose, but the rules collapse to "pick a label from the allow-list" — the live behavior is single-label-per-slot, not freeform sentences. The SYSTEM prompt is contradictory; the canonicalizer at [explainer.ts:693-728](scorer-node/src/explainer.ts#L693-L728) enforces label-mode.

**Single-image USER prompt:**
```
You are given one face image and numeric metric scores (0–100).

Use score ranges only to calibrate language strength (do NOT output scores):
- 0–40 developing, 41–64 improving, 65–79 sharp, 80–100 elite.
Before writing each metric, silently match the score to its tier and note the clearest visual evidence.
Each line must point to that evidence or the sharpest refinement, not generic praise.
Keep wording neutral and specific regardless of tier.

For EACH metric, write FOUR lines in the fixed sub-metric order listed in the system prompt.
Use the image to pick concrete visible traits, not generic praise. JSON only.

Scores JSON:
{"jawline":72,"facial_symmetry":41,"skin_quality":68,"cheekbones":59,"eyes_symmetry":74,"nose_harmony":33,"sexual_dimorphism":86}
```

**Pair USER prompt:**
```
You are given TWO images of the SAME face: first = frontal, second = right-side profile, plus metric scores.

(tierGuide identical)

Pair discipline:
- Use BOTH views. If a cue is profile-only (e.g., bridge blend, under-jaw angle), mention that cue once with "(profile)".
- For symmetry, name side and dimension (e.g., "left tilt", "right height").
- Write FOUR lines per metric in the fixed sub-metric order from the system prompt. JSON only.

Scores JSON:
{...}
```

### 2.4 Advanced explain — sentence + score + verdict per sub-metric — [explainer.ts:791-883](scorer-node/src/explainer.ts#L791-L883)

- Same model as explainer. Params: `temperature: 0.2, top_p: 0.85, max_tokens: 1800, response_format: json_object`.
- Prompt version: `adv.v3.1`.
- Inputs: frontal bytes (required) + side bytes (optional) + 4 category scores (cheekbones, jawline, eyes_symmetry, skin_quality).
- Output: nested object `{ cheekbones, jawline, eyes, skin }` where each sub-metric returns a 20–90-word commentary, an integer score, and a verdict label drawn from a fixed list (or numeric estimate for canthal tilt + gonial angle).
- Coerced via `str/num/vrd` helpers; verdicts clamped to 30 chars.

**ADVANCED_SYSTEM_PROMPT (verbatim — load-bearing):**
```
You are a calibrated facial-aesthetics analyst. Score and describe each sub-metric based strictly on what is visible in the provided image(s).

━━━ SCORING RULES ━━━
- Scores are 0–100. Population distribution: most people 35–65, above average 66–74, strong 75–84, exceptional 85+.
- Do NOT inflate. An average feature scores 45–55. A feature must be visibly pronounced to exceed 70.
- Sub-metric scores within each category MUST average close to the provided category score. If category score is 55, sub-metrics must average near 55 — not 65+.
- When uncertain, score lower. Optimism is a calibration error.

━━━ COMMENTARY RULES ━━━
- One sentence per sub-metric (20–90 words). Present tense. Conversational but honest — write like a knowledgeable coach, not a medical report.
- No medical advice. No ethnicity or identity claims. No emojis. No markdown. No jargon the average person wouldn't know.
- No filler phrases like "contributing to a balanced structure" or "adding to overall harmony" — these say nothing.
- If a feature is genuinely strong, confirm it plainly with the specific visible reason.

━━━ TIER-AWARE TONE ━━━
The score determines the writing register. Match it exactly.

Score 72–100 (strong/exceptional):
  Confirm the strength. State the specific visible reason it scores well. One clean sentence.
  Do NOT add improvement notes unless there is a genuinely visible limiting factor.
  Example: "The jaw corner sits at roughly 102° and reads as sharp and angular — it anchors the lower face cleanly."

Score 55–71 (present but not strong):
  The feature exists but something specific is holding it back. Name that thing.
  End with the one change that would make the biggest visible difference. Keep it plain — no jargon.
  The user must feel "I know exactly what to work on," not "well, this seems okay."
  NEVER write a neutral observation for this tier. Every sentence needs a direction.
  Example: "There's width here, but not enough to cast a shadow under the cheekbones — getting leaner is the most direct way to change that."

Score 0–54 (underdeveloped):
  Be direct about the gap. No softening. Name the specific limitation visible in the image.
  One concrete direction. Keep language plain and respectful — honest, not harsh.
  Example: "The jaw edge is soft and doesn't hold a clear line from the front — the corner rounds off before it creates any definition."

━━━ CALIBRATION EXAMPLES ━━━
Score ~62 (Just Okay — needs direction):
  "The cheekbones have some width but not enough spread to create that high, lifted look — dropping body fat is the clearest lever here."
  verdict: "Moderate Width"

Score ~78 (strong):
  "The gonial angle appears to be around 102°, creating a well-defined jaw corner that adds clear angularity to the lower third of the face."
  verdict: "Chiseled"

Score ~88 (exceptional):
  "The canthal tilt is clearly positive at around +4° — the outer corners sit higher than the inner corners, which gives the eyes a focused, sharp quality."
  verdict: "Hunter"

━━━ FWHR INSTRUCTIONS ━━━
cheekbones.fwhr — estimate facial width-to-height ratio (bizygomatic width ÷ upper face height) from the frontal image.
- This is a VISUAL ESTIMATE. Your commentary MUST include the word "appears" or "estimated".
- Masculine ideal: ~1.9–2.0. Feminine average: ~1.6–1.8.
- Score >80 if estimated ≥1.9 (masculine) or ≥1.7 (feminine context). Score 45–60 for average proportions.
- If hair, hat, or beard fully obscures bizygomatic width: state this and return score 50, verdict "Average (1.7–1.89)".

━━━ RAMUS INSTRUCTIONS ━━━
jawline.ramus — assess ramus height and verticality from the SIDE IMAGE if provided.
- Ramus is the vertical portion of the mandible connecting the jaw angle to the condyle.
- Ideal: tall and near-vertical. A taller, more vertical ramus creates a stronger, more defined jaw corner.
- Score >75 if ramus appears tall and near-vertical. Score 40–55 if short or steeply angled.
- If NO side image was provided: return "" for commentary, 50 for score, "" for verdict. Do NOT fabricate an assessment from a frontal view.

VERDICT LABELS — for each sub-metric also return a "verdict" field as described below.

LABEL-BASED sub-metrics: pick EXACTLY ONE label from the allowed list (1–3 words, case-sensitive).

cheekbones.width_verdict:          Ideal Width | Well Spaced | Moderate Width | Narrow | Too Wide
cheekbones.maxilla_verdict:        Well Developed | Forward Set | Adequate | Underdeveloped | Recessed
cheekbones.bone_structure_verdict: Sculpted | Well Defined | Defined | Moderate | Flat
cheekbones.face_fat_verdict:       Very Lean | Lean | Athletic | Moderate | Full | Puffy
cheekbones.fwhr_verdict:           Wide (≥2.0) | Broad (1.9–1.99) | Average (1.7–1.89) | Narrow (<1.7)
jawline.development_verdict:       Razor Sharp | Well Defined | Chiseled | Moderate | Minimal | Weak
jawline.projection_verdict:        Strong | Good Projection | Proportional | Moderate | Weak | Recessed
jawline.ramus_verdict:             Vertical | Well Angled | Moderate | Short | Steep
  - Return "" (empty string) if no side image was provided.
eyes.eye_type_verdict:             Hunter | Almond | Upturned | Neutral | Slightly Hooded | Downturned | Prey Eyes
eyes.brow_volume_verdict:          Full | Well Defined | Adequate | Moderate | Sparse | Thin
eyes.symmetry_verdict:             Symmetrical | Well Balanced | Minimal Asymmetry | Slight Asymmetry | Noticeable
skin.color_verdict:                Even Tone | Clear | Mostly Even | Slight Uneven | Uneven | Discolored
skin.quality_verdict:              Flawless | Very Smooth | Smooth | Moderate | Rough | Damaged

NUMERICAL sub-metrics: return an estimated value, not a label.

eyes.canthal_tilt_verdict:
  - Estimate the outer-corner tilt angle in degrees from the image.
  - Positive = outer corner tilts upward. Negative = downward. Zero = level.
  - Format: signed integer followed by ° symbol. Examples: +5°, +2°, 0°, -3°, -7°
  - Realistic range: -8° to +8°. Do NOT exceed this range.

jawline.gonial_angle_verdict:
  - Estimate the gonial angle (jaw corner angle) in degrees from the image.
  - Format: integer followed by ° symbol. Examples: 98°, 108°, 118°, 128°
  - Realistic range: 90° to 140°. Ideal is 95–115°. Do NOT exceed this range.

━━━ RETURN FORMAT ━━━
Return STRICT JSON with this exact shape and no other text:

{
  "cheekbones": { width, width_score, width_verdict, maxilla, maxilla_score, maxilla_verdict, bone_structure, ..., fwhr, fwhr_score, fwhr_verdict },
  "jawline": { development, development_score, development_verdict, gonial_angle, ..., ramus (empty if no side), ramus_score, ramus_verdict },
  "eyes": { canthal_tilt, ..., eye_type, ..., brow_volume, ..., symmetry, ... },
  "skin": { color, color_score, color_verdict, quality, quality_score, quality_verdict }
}
```

**USER prompt template (advanced):**
```
You have been given TWO images: image 1 = frontal face, image 2 = side profile. Use BOTH.
  -- OR (if no side) --
You have been given ONE image: frontal face only. Ramus cannot be assessed — follow ramus instructions above.

Category scores (0–100) — your sub-metric scores MUST average close to these per category:
- cheekbones: 59
- jawline:    72
- eyes:       74
- skin:       68

Analyze the image(s). Return a score (integer 0–100), one sentence, and a verdict for every sub-metric.
Most people score 35–65. Do not inflate. JSON only — no surrounding text.
```

Both images are sent with `image_url.detail: "high"`.

### 2.5 Insights (cross-scan progress) — [generateInsights.ts:208-251](scorer-node/src/insights/generateInsights.ts#L208-L251)

- Model: `gpt-4o-mini`. Params: `temperature: 0.4, max_tokens: 2000`. **No `response_format` set** — relies on `extractJson` to strip code fences.
- Inputs: up to 6 selected `ScanRecord`s (baseline + previous + latest, plus best/worst/30-days-ago when ≥10 scans), enriched with up to 3 short v2 explanation snippets per scan.
- Output: `InsightContentSchema` ([validators.ts:168-182](scorer-node/src/validators.ts#L168-L182)) — `overall_delta`, `verdict`, `narrative` (≤500 char), per-metric delta + verdict, optional `advanced` array.

**System prompt (full):**
```
You are an expert facial aesthetics coach. Analyze the user's facial scan history and return a JSON progress insight. Be honest, specific, and encouraging. Return only valid JSON, no markdown.
```

**User prompt template** (rendered example):
```
The user has completed 4 facial scan(s). Analyze their progress.

SCAN HISTORY:
Scan #1 (Baseline) — Mar 12, 2026:
  Overall: 58.4
  Jawline: 62, Symmetry: 54, Skin: 60
  Cheekbones: 55, Eyes: 63, Nose: 57, Masculinity: 58
  AI Analysis: Well-Defined; Slight Asymmetry; Defined(109–113°)

Scan #3 — Apr 02, 2026:
  Overall: 61.1
  ...

Scan #4 (Latest) — Apr 28, 2026:
  Overall: 64.7
  ...

Overall score change from baseline to latest: +6.3

Return a JSON object with this exact structure:
{
  "overall_delta": <number — difference in overall avg from baseline to latest>,
  "verdict": <"improved" | "same" | "declined" — improved if overall_delta > 1.5, declined if < -1.5, else same>,
  "narrative": <2-3 sentences, max 300 chars — honest, specific, motivating. Reference actual score numbers.>,
  "metrics": {
    "jawline": { "delta": <latest - baseline>, "verdict": <"improved"|"same"|"declined"> },
    ... (all 7 metrics) ...
  },
  "advanced": [
    { "label": <short anatomical label, max 30 chars>, "comment": <specific observation, max 80 chars>, "change": <"improving"|"same"|"worse"> },
    ... (10 to 13 items total, covering: jaw definition, cheekbone projection, skin texture, eye spacing, brow structure, nose bridge, lip definition, facial thirds balance, temple width, chin projection, neck-jaw angle, overall symmetry, masculinity markers)
  ]
}

Metric verdict rules: "improved" if delta >= 2, "declined" if delta <= -2, else "same".
Advanced change rules: "improving" if trending upward across scans, "worse" if trending down, "same" if stable.
Return only the JSON object, no markdown fences.
```

### 2.6 Sigma chat — [services/sigmaPrompt.ts](scorer-node/src/services/sigmaPrompt.ts) + [services/sigmaOpenAI.ts](scorer-node/src/services/sigmaOpenAI.ts)

- Model: `PROVIDERS.openai.sigmaModel`. `temperature`, `max_tokens` from `PROVIDERS.openai.sigma*`. `response_format: text`.
- Inputs: `user_text` plus optional `share_scores` (latest 7-metric map) and `share_routine` (`active_routine_day`).
- Output: free text. The wrapper extracts trailing bullet lines as `suggested_next_steps`.

**System (verbatim):**
```
You are Sigma — the ultimate looksmaxxing coach and facial aesthetics bro.
You talk like a knowledgeable gym bro who's deep into mewing, bonesmashing, facial exercises, skincare, posture, nutrition, and self-improvement.
You keep it real, hype the user up, and drop knowledge like you're coaching your best friend to ascend.

Vibe & tone:
- Confident, direct, motivating — like a bro who genuinely wants you to glow up.
- Use casual language naturally ("bro", "king", "trust me", "no cap") but don't overdo it — keep it authentic, not cringe.
- Back up advice with real science (biomechanics, anatomy, dermatology) but explain it in simple terms.
- Be concise. No essays. Get to the point fast.

Rules:
1. Do NOT provide medical diagnosis or prescribe medication.
2. Ground all advice in anatomy, biomechanics, and dermatology fundamentals.
3. Never exaggerate results or promise bone remodeling timelines.
4. Recommend professional consultation for anything invasive.
5. NEVER use a TLDR section or label. Just start talking directly.

Response format:
- Jump straight into the answer. No "TLDR:" headers or summaries at the top.
- Keep responses short and punchy — a few sentences to a short paragraph.
- Use bullet points for actionable steps when needed (3-5 max).
- Drop a quick safety note only if relevant (don't force it every time).
- End with 2-3 short follow-up suggestions the user can tap as chips.

User facial scores: jawline: 72/100, facial_symmetry: 41/100, ... (only when share_scores).
User is currently on routine day 7. (only when share_routine).
```

User content: raw `user_text.trim()`.

---

## 3. Scan output schema

Schema is **not in this repo** (memory note: "managed server-side, no migrations checked in"). Inferred from typed Supabase access modules.

### Table: `users` — [scorer-node/src/supabase/users.ts](scorer-node/src/supabase/users.ts)

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | uuid (PK) | auth | Supabase auth user id (anonymous or email-linked) |
| `email` | text? | user | from email upgrade |
| `age` | int? | onboarding | derived from `dob` client-side |
| `gender` | text? | onboarding | free string; client values currently come from `gender.tsx` pill list |
| `ethnicity` | text? | onboarding | free string; client values: `Asian`, `African`, `Caucasian`, `Hispanic / Latino`, `Middle Eastern`, `Mixed / Other`, `Prefer not to say` |
| `onboarding_completed` | bool? | client | |
| `device_id` | text? | client | |

### Table: `scans` — [scorer-node/src/supabase/scans.ts](scorer-node/src/supabase/scans.ts)

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | uuid (PK) | db | |
| `user_id` | uuid → users.id | server | |
| `created_at` | timestamptz | db | |
| `model_version` | text | server | which model produced scores (e.g. `gpt-4o-2024-08-06`, `ml-vN`) |
| `front_image_path` | text | server | object key in `face-scans` bucket, format `${userId}/${ts}-front[-reqId].jpg` |
| `side_image_path` | text? | server | optional |
| `scores` | jsonb | LLM/ML | the 7-metric `Scores` object (clamped, anti-five-snapped) |

### Table: `analyses` — [scorer-node/src/supabase/analyses.ts](scorer-node/src/supabase/analyses.ts)

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | uuid (PK) | db | |
| `scan_id` | uuid → scans.id | server | |
| `created_at` | timestamptz | db | |
| `explanations` | jsonb | LLM | `ExplanationsV2` shape (4 labels per metric) |
| `advanced_result` | jsonb? | LLM | `AdvancedExplainResult` shape — score+sentence+verdict per sub-metric, includes FWHR + ramus |

### Table: `insights` — [scorer-node/src/supabase/insights.ts](scorer-node/src/supabase/insights.ts)

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | uuid (PK) | db | |
| `user_id` | uuid → users.id | server | |
| `latest_scan_id` | uuid → scans.id | server | unique with `user_id` |
| `created_at` | timestamptz | db | |
| `content` | jsonb | LLM | `InsightContent` (overall_delta, verdict, narrative, metrics{}, advanced[]) |

### Other tables referenced (not load-bearing for potential-face)

- `programs`, `program_completions` — legacy 70-day program ([src/supabase/programs.ts](scorer-node/src/supabase/programs.ts)).
- `recovery_codes` — account recovery.
- `user_task_history`, `user_streaks` — daily routine completion ([facely/lib/supabase/taskSync.ts](facely/lib/supabase/taskSync.ts)).
- `app_config` — kill-switch / version gate ([facely/lib/updateCheck.ts](facely/lib/updateCheck.ts)).

### Storage bucket: `face-scans`

[scorer-node/src/supabase/storage.ts:13](scorer-node/src/supabase/storage.ts#L13) — keyed `${userId}/${ts}-${variant}[-${requestId}].jpg`. Signed URLs (1h default) for serving back to the client.

There is **no dedicated table** for the existing ten-by-ten generation. The generated b64 is returned directly to the client, base64-decoded, and saved to `${FileSystem.documentDirectory}ten-by-ten/` as a local-only JPEG ([facely/store/tenByTen.ts:47-64](facely/store/tenByTen.ts#L47-L64)). It is **not persisted server-side** and is not visible cross-device. Quota is also client-side only (`monthlyCount`, `monthKey` in zustand-persist).

---

## 4. Protocol / recommendation generation

Three independent prompt sites, all `gpt-4o-mini`, all `response_format: json_object`, all constrained to a hand-curated "Sauce" library to prevent the model inventing protocols.

### 4.1 `/recommendations` — [recommender.ts:30-101](scorer-node/src/recommender.ts#L30-L101)

- Inputs (`RecommendationsRequest`): `age` (int 10–100), `gender?`, `ethnicity?`, `metrics[]` (per-metric `{key, score, notes?}`).
- Output: `summary`, `items[]` (3–5+) of `{metric, score, title≤40, recommendation≤220, finding≤120, priority, expected_gain?}`, `version: "v1"`.
- Params: `temperature: 0.4, max_tokens: 600`.

**System (verbatim):**
```
You are a board-certified aesthetician and evidence-driven coach.
The user provides demographics and metric scores (0–100).
Return STRICT JSON in this exact shape:
{
  "summary": string,
  "items": [
    {
      "metric": one of ["jawline","facial_symmetry","skin_quality","cheekbones","eyes_symmetry","nose_harmony","sexual_dimorphism"],
      "score": number (0–100),
      "title": string (short, imperative task, ≤40 chars),
      "recommendation": string (≤220 chars, plain language, actionable),
      "finding": string (≤120 chars, optional),
      "priority": "low" | "medium" | "high",
      "expected_gain": number (0–100, optional)
    }
  ],
  "version": "v1"
}
Constraints:
- Focus on habits, skincare basics, grooming, posture, lighting, photography, fitness, fat %, hydration.
- Plain language. No emojis. No links. No markdown. No extra commentary.
- Always include at least 3–5 items if possible.
- JSON only. Do not wrap in code fences or text.
```

**User prompt:** `JSON.stringify(req)` — i.e. raw `{age, gender?, ethnicity?, metrics[]}`. *Identity is explicit here.*

### 4.2 `/protocols` — [routes/protocols.ts:63-164](scorer-node/src/routes/protocols.ts#L63-L164)

- Inputs: either `{scanId}` (server hydrates scores+explanations from `scans` + `analyses`) or `{scores, explanations?}` directly.
- Output: 8-bucket protocol map: `glass_skin`, `debloating`, `facial_symmetry`, `maxilla`, `hunter_eyes`, `cheekbones`, `nose`, `jawline`. Each value is one string drawn from a hard-coded library embedded in the prompt.
- Params: `temperature: 0.25, max_tokens: 400, json_object`. Identity NOT injected.

**System (verbatim — abridged: full protocol library is quoted inside the prompt; reproduced here in full because it is the constraint):**
```
You are a facial improvement coach.
Given face scores (0-100) and optional brief explanations (strings), pick EXACTLY ONE protocol per bucket from the fixed library below.
Buckets: glass_skin, debloating, facial_symmetry, maxilla, hunter_eyes, cheekbones, nose, jawline.
Rules:
- Choose only from the provided protocol strings. Never invent or rewrite.
- Tailor selections to the strongest needs implied by scores and explanations.
- Output STRICT JSON matching the required schema and nothing else.
Allowed protocol library:
Glass Skin:
"Wash + Moisturize + SPF 30"
"Exfoliate 2A-/week"
"Retinol 0.25% twice weekly"
"Eye serum HA + peptides PM"
"Accutane consult"

Debloating:
"Chew 25 each bite"
"Tongue-led swallow"
"10-min walk post-meal"
"Na:K ratio 3:2 daily"
"Remove seed oils"
"Ceylon cinnamon with fruit"

Facial Symmetry:
"Thumb pull + chin tuck 2A-30s"
"Tongue chew 6 min"
"Eye + mouth drills 1 min each"
"Hang 3A-30s"
"Sprint 30s  3"

Maxilla:
"MU lift 5 min"
"Nasal breathing 7 min"
"Hard foods for jaw activation"

Hunter Eyes:
"Eye resistance close 3A-10 reps"
"Relax eyebrows"
"Brush/oil brows"

Cheekbones:
"Lateral thumb pull 3A-30s"
"Tongue-led swallow"
"Mastic gum 6 min"

Nose:
"Thumb pull + chin tuck"
"Tongue to palate 10 reps"
"Light bridge tapping 30s"
"Avoid lectins/phytates/oxalates"
"Clay mask 10 min"

Jawline:
"Chin tuck 2A-20s"
"Deep nasal breathing 5 min"
"Thumb push on palate 3A-30s"
```

**User prompt:** `JSON.stringify({scores, explanations, modelVersion, source, scanId, required_schema:{protocols:[...buckets]}}, null, 2)`.

### 4.3 `/routine` — 15-day daily routine — [utils/generateRoutine.ts:392-466](scorer-node/src/utils/generateRoutine.ts#L392-L466)

- Inputs: `Scores` + optional `context_hint`. **Default 15 days, 5 components/day** (legacy 70-day program is deprecated per memory).
- Output schema (`RoutineSchema`): `{ days: [{day:1..15, components:[{headline, category, protocol}] x5}] }`.
- Library: full `PROTOCOL_LIBRARY` is embedded into the system prompt as JSON.stringify ([protocolLibrary.ts](scorer-node/src/data/protocolLibrary.ts)).
- Params: `temperature: 0.2, max_tokens: 4000, json_object`. Two-pass: direct, then "repair" call if validation fails.
- Server-side guards: `STRICT_SAUCE` mode rejects any protocol not in the library; `FORBIDDEN_TERMS = ["makeup","contour","highlighter","bronzer","jade roller","mask","cream","serum","toner","facial yoga","selfie","visualization"]` always banned. Lenient mode replaces banned/version-tag (`v1`/`v2`) protocols with a `SAFE_DEFAULT_PROTOCOL`.

**System prompt (primary, verbatim):**
```
You output STRICT JSON only. No prose. No extra keys.
Schema: { "days":[{ "day":1,"components":[{ "headline":string,"category":string,"protocol":string } x5}] x15 }
Exactly 15 days (1..15). Exactly 5 components per day.
protocol MUST be chosen ONLY from the allowed library (The Sauce). Do NOT invent or paraphrase.
Never output version tags (e.g., v1, v2) or placeholders as protocols.
category MUST be one of: Glass Skin, Debloating, Facial Symmetry, Maxilla, Hunter Eyes, Cheekbones, Nose, Jawline.
Forbidden terms: makeup, contour, highlighter, bronzer, jade roller, mask, cream, serum, toner, facial yoga, selfie, visualization.
If unsure, pick the closest valid protocol from the library. Never output forbidden items.
Allowed protocol library (The Sauce):
{ ...PROTOCOL_LIBRARY rendered as JSON... }
Output JSON only.
```

**User (primary):**
```
Generate a 15-day routine with 5 components/day using ONLY protocols from The Sauce.
Forbidden terms are disallowed under any circumstance.
Never output version tags (e.g., v1, v2) as protocols.
{ "scores": {...}, "context_hint": null, "n_days": 15 }
Return JSON only matching the schema.
```

**Repair pass** (`buildRepairSystemPrompt`/`buildRepairUserPrompt`) is invoked when the direct response fails parse/validation/finish_reason=length. It restates the schema and library, then asks the model to fix the original raw output.

### How recommendations link to scan findings

- `/recommendations` and `/routine` receive **only the 7-metric scores**. They do not see the per-sub-metric labels or advanced commentary.
- `/protocols` receives **scores + v2 explanations** (the 4 label tokens per metric), so it has slightly richer context.
- None of the three sees the original face image. None of them sees the advanced FWHR / canthal-tilt-degree estimates from `analyses.advanced_result` — that data is currently only consumed by the client UI.

---

## 5. Image handling beyond capture

### Capture (client)
- [facely/app/(onboarding)/scan.tsx](facely/app/(onboarding)/scan.tsx) and tab scan flow use expo-camera; compressed to ~1080px JPEG (per memory note).
- Stored transiently on `useOnboarding.scanFrontalUri` / `scanSideUri`.

### Upload + scoring (server)
- POST `/analyze/pair` (multipart) → uploads both images to bucket `face-scans` via [supabase/storage.ts](scorer-node/src/supabase/storage.ts), creates a `scans` row, runs ML or OpenAI scoring, runs explainer, returns scores + scanId.
- [scorer-node/src/lib/image-normalize.ts](scorer-node/src/lib/image-normalize.ts) — sniffs JPEG/PNG/WEBP/GIF/HEIC via magic bytes or `file-type`, auto-rotates with `sharp`, downscales longest edge to ≤1024 px, re-encodes to JPEG data URL. Also handles HEIC via `heic-convert` ([types/heic-convert.d.ts](scorer-node/src/types/heic-convert.d.ts)).
- Both scoring + explainer pass `image_url` data URLs to OpenAI vision. Advanced explain uses `detail: "high"`; explain/score don't set `detail`.

### Existing image generation (the v1 of the "potential face" feature)
- **Active path:** POST `/generate/ten-by-ten` ([scorer-node/src/routes/generate.ts](scorer-node/src/routes/generate.ts)).
  - Multer disk-storage, 15 MB limit, accepts `image/jpeg|png|webp|application/octet-stream`.
  - Calls `openai.images.edit({ model: "gpt-image-2", image: toFile(buffer, "face.jpg"), prompt, n:1, size:"1024x1024" })`.
  - Returns `{ b64 }` (base64 image).
  - **No image normalization** before send (unlike scoring path) — raw upload bytes are forwarded.
  - **No mask** is provided, so gpt-image-2 free-edits the whole image.
- **Stale duplicate:** Supabase edge function [supabase/functions/generate-ten-by-ten/index.ts](supabase/functions/generate-ten-by-ten/index.ts) — accepts `imageBase64` JSON instead of multipart, calls the same OpenAI endpoint, slightly older prompt (no "preserve original lighting / background / no plastic sheen" guards). The mobile client points at `${API_BASE}/generate/ten-by-ten`, **not** the edge function. The edge function appears to be dead code.

### Image gen prompt (active, [routes/generate.ts:48-64](scorer-node/src/routes/generate.ts#L48-L64))

Template:
```
function buildPrompt(meta: { gender?: string; ethnicity?: string; age?: string }) {
  const genderNote = meta.gender ? `${meta.gender} person` : "person";
  const ethnicityNote = meta.ethnicity ? `, ${meta.ethnicity} ethnicity` : "";
  const ageNote = meta.age ? `, approximately ${meta.age} years old` : "";

  return (
    `Enhance this ${genderNote}${ethnicityNote}${ageNote} to their ideal facial potential. ` +
    `Make the following improvements while strictly preserving their identity, skin tone, eye color, and hair: ` +
    `(1) sharpen and define the jawline and chin for a chiseled, well-structured look, ` +
    `(2) create hunter eyes with a positive canthal tilt and well-defined orbital rims, eyes color must stay consistent ` +
    `(3) improve forward maxilla projection and cheekbone prominence, ` +
    `(4) clear and even the skin — remove blemishes and redness, but preserve real skin texture, visible pores, and natural micro-imperfections. ` +
    `The result must be photorealistic and clearly the same person — just their best version. ` +
    `CRITICAL: preserve the exact original photo lighting, color temperature, and background — absolutely no warm golden tint, no color grading, no studio lighting added. ` +
    `The skin must look like real human skin, not digital — no plastic sheen, no waxy smoothness, no airbrushed finish.`
  );
}
```

Rendered example with `gender="male", ethnicity="Asian", age="22"`:
```
Enhance this male person, Asian ethnicity, approximately 22 years old to their ideal facial potential. Make the following improvements while strictly preserving their identity, skin tone, eye color, and hair: (1) sharpen and define the jawline and chin for a chiseled, well-structured look, (2) create hunter eyes with a positive canthal tilt and well-defined orbital rims, eyes color must stay consistent (3) improve forward maxilla projection and cheekbone prominence, (4) clear and even the skin — remove blemishes and redness, but preserve real skin texture, visible pores, and natural micro-imperfections. The result must be photorealistic and clearly the same person — just their best version. CRITICAL: preserve the exact original photo lighting, color temperature, and background — absolutely no warm golden tint, no color grading, no studio lighting added. The skin must look like real human skin, not digital — no plastic sheen, no waxy smoothness, no airbrushed finish.
```

### Stale duplicate prompt — [supabase/functions/generate-ten-by-ten/index.ts:16-34](supabase/functions/generate-ten-by-ten/index.ts#L16-L34)

```
Enhance this {gender} person{, ethnicity}{, approximately N years old} to their ideal facial potential. Make the following improvements while strictly preserving their identity, skin tone, eye color, and hair: (1) sharpen and define the jawline and chin for a chiseled look, (2) create hunter eyes with a slight positive canthal tilt and well-defined orbital rims, (3) improve forward maxilla projection and cheekbone prominence, (4) clear, smooth, and perfect the skin texture and complexion. The result must be photorealistic, natural-looking, and clearly the same person — just their best version.
```

(Note: this older version says "clear, smooth, and perfect the skin texture and complexion" — which is the **opposite** of the active prompt's "preserve real skin texture, visible pores, and natural micro-imperfections" guard. The active prompt was specifically tightened to avoid airbrushed output.)

### No other image generation
Grep for `images.edit|images.generate|gpt-image|dall-e` outside `generate.ts` + the edge function returns nothing else. There is no annotation/overlay on captured scans — only display.

---

## 6. Identity handling

**Captured at onboarding** ([facely/store/onboarding.ts](facely/store/onboarding.ts)):
- `dob` (ISO `YYYY-MM-DD`) → derived `age`
- `gender` — string from `gender.tsx` pill list
- `ethnicity` — one of `Asian | African | Caucasian | Hispanic / Latino | Middle Eastern | Mixed / Other | Prefer not to say` ([(onboarding)/ethnicity.tsx:23-31](facely/app/(onboarding)/ethnicity.tsx#L23-L31)). Free-text in the schema (`z.string().optional()`) but UI is constrained.
- `looksmaxxingExperience`, `goals[]`, `improveFocus[]`, `timeDedication`

**Persisted server-side**: `users.age, users.gender, users.ethnicity` ([scorer-node/src/supabase/users.ts](scorer-node/src/supabase/users.ts)).

**Where identity flows into prompts:**

| Site | Identity used? | Notes |
|---|---|---|
| Scoring (single + pair) | **No** — explicitly redacted: *"Do not identify the person or infer age, gender identity, race/ethnicity, health, or other protected attributes."* The `sexual_dimorphism` metric is scored as "degree of culturally typical trait expression" without inferring identity. |
| Explain (4-line) | **No** — *"No causes, routines, medical, identity or ethnicity claims."* But the FWHR sub-metric internally references "Masculine ideal: ~1.9–2.0. Feminine average: ~1.6–1.8." — implicit gender heuristic that the model may apply silently. |
| Advanced explain | **No** — same redaction. FWHR + ramus rules embed gendered ideal ratios. |
| Insights | **No** — only deltas across scans. |
| Sigma chat | **Implicit** — bro persona presumes male user; not gated by `gender` field. Scores + routine day are conditionally injected (`share_scores`, `share_routine`). |
| `/recommendations` | **Yes — explicit.** `age`, `gender`, `ethnicity` are part of `RecommendationsRequest` and serialized straight into the user message. |
| `/protocols` | **No** — only scores + v2 labels. |
| `/routine` | **No** — only scores + free-text `context_hint`. |
| `/generate/ten-by-ten` (potential-face v1) | **Yes — explicit and central.** Gender, ethnicity, age are interpolated into the prompt verbatim. The prompt also relies on the *image* to anchor "skin tone, eye color, hair". |

**Implicit identity hotspots (flag for new pipeline design):**
- The `sexual_dimorphism` metric and the `masculinity cues` 4-line explanations bake masculine-ideal anchors into the rubric without the user declaring gender. A female user gets scored against the same anchors.
- FWHR rule for advanced explain hard-codes masculine vs. feminine ideal bands; the model decides which to apply by inference.
- `improve-areas` / `goals` from onboarding (e.g. "fix jawline", "hunter eyes") are stored but **never fed into any prompt** — they could anchor the potential-face direction but currently don't.
- `ethnicity` is captured but only used by `/recommendations` and `/generate/ten-by-ten`. Other prompts (explain/routine/protocols) ignore it, which means recommended routines are ethnicity-blind.
- `users` server-side row has `age/gender/ethnicity`, but the ten-by-ten client re-reads them from the local zustand store ([app/(tabs)/ten-by-ten.tsx:217-224](facely/app/(tabs)/ten-by-ten.tsx#L217-L224)) and forwards them as form fields. Server doesn't cross-check against `users` row.

---

## 7. Known issues / failure modes

### From comments
- Only one TODO in scan/prompt area: [routes/promo.ts:61](scorer-node/src/routes/promo.ts#L61) — promo code usage tracking, unrelated.
- No FIXME/HACK markers in scorer-node/src.

### From recent git history (last 30 days, root + scorer-node + supabase)

```
52ebe47 2026-04-29 coding after version 1.9.0
687efa8 2026-04-21 bump ios buildNumber to 16
d22fec3 2026-04-21 reall fixed
46998dc 2026-04-21 analysis fix
85e5d44 2026-04-18 new tracking screen started
5f3e327 2026-04-15 new changesss
7ac61df 2026-04-15 ai prompt improved
ab292f1 2026-04-07 stilladvanced analysis
b766101 2026-04-07 new code for advanced analysis
2d93054 2026-04-07 previous state of adding new advanced analysis system
```

Pattern: prompts have been actively churned in April. `7ac61df ai prompt improved` and `46998dc analysis fix` + the cluster around "advanced analysis" indicate the advanced-explain prompt (`adv.v3.1`) and FWHR/ramus blocks were recently added/tuned. Worth treating advanced-explain as the most volatile of the prompts.

### Recurring-problem signals embedded in current code (not TODOs, but defensive measures that imply prior bugs)
- `antiFiveSnap` post-processor in scorer.ts — implies the model was clustering on multiples of 5 even with explicit prompt instruction.
- `RANGE_DISCIPLINE` block — implies "regression to the mean" / 60–75 clustering was a real failure mode.
- `parseScoresStrict` 0–10-vs-0–100 auto-detection — implies some model versions returned the wrong scale.
- `KEY_ALIASES = { symmetry → facial_symmetry, eyes → eyes_symmetry, nose → nose_harmony }` — older prompts produced these short keys.
- `cleanRoutineInLenientMode` replacing `v1`/`v2` placeholder protocols and forbidden terms — implies the model emitted version tags as protocols.
- `FORBIDDEN_TERMS` in routine generator — prior "makeup", "facial yoga", "selfie", "visualization" etc. leaks.
- Explainer's Levenshtein fallback canonicalizer — implies the model frequently returns near-misses on the allowed-label list.
- Insights extractor strips ```` ```json ```` fences — implies the model wrapped output despite instructions, and `gpt-4o-mini` here is called **without** `response_format: json_object`.
- `isAllZero` + multi-model fallback sequence — implies all-zero score responses were observed.
- ten-by-ten quota of 2 generations per calendar month per user is **client-side only** (zustand-persist). Wiping app data resets it. Server has no enforcement ([routes/generate.ts:70-142](scorer-node/src/routes/generate.ts#L70-L142)).

### Architectural
- Two divergent ten-by-ten prompts (active route vs. dead supabase function) — when iterating, easy to update only one.
- Generated image is local-only (no DB row, no storage upload) → can't show across devices, can't be referenced by other prompts (e.g. "compare your goal photo to your latest scan"), can't be moderated/audited server-side.

---

## 8. Open questions

1. **Should the new pipeline replace or coexist with `/generate/ten-by-ten`?** The existing endpoint is shipping in the "You as a 10/10" tab. If the new pipeline supersedes it, the ten-by-ten tab and `tenByTen` store will need migration; if coexisting, what differentiates them in the UI?
2. **Server-side persistence of generated images.** Is the new pipeline expected to write to a new `face_generations` (or similar) Supabase table + `face-scans`-equivalent bucket? Current implementation throws away the image after returning b64.
3. **Quota enforcement.** Current 2/month is client-side only. New pipeline likely needs a server-side counter — should it share quota with the existing one?
4. **Should the prompt be conditioned on the user's actual scan scores / per-sub-metric labels / advanced verdicts?** Right now the gen prompt is a fixed "jawline + hunter eyes + maxilla + skin" recipe regardless of the user's strongest/weakest metrics. A user already at `jawline: 88` doesn't need jaw enhancement.
5. **Should it be conditioned on the user's protocols / routine?** The feature pitch (per task description) is "what they could look like *after* executing their improvement protocols". Currently the prompt has no notion of protocols — it just describes the looksmaxxing destination, not the user's chosen path.
6. **Identity: `goals` and `improveFocus` from onboarding are unused.** Should the new prompt incorporate them ("focus on jawline + hunter eyes" if those are the user's goals)?
7. **Identity: `ethnicity` interpolation safety.** The ethnicity values are user-selected free-form-ish strings (`"Mixed / Other"`, `"Prefer not to say"`); the prompt currently emits `, Mixed / Other ethnicity` or `, Prefer not to say ethnicity` literally. Is that handled, or should we whitelist/normalize?
8. **Mask vs free-edit.** `images.edit` is called without a mask, so gpt-image-2 may alter background, framing, hair. The prompt fights this with "preserve background / lighting / hair" — would a face mask + bg-preservation strategy be more reliable?
9. **Side-profile usage.** Scoring + advanced explain take a side image, but ten-by-ten only takes one image. Is a multi-view potential-face within scope?
10. **Reference scan image.** The client uses `useScores.imageUri` (in-memory only) or a fresh ImagePicker pick — it does **not** retrieve the persisted `front_image_path` from the user's scan history. Should the new pipeline anchor off the user's most recent (or best?) scan automatically?
11. **Schema source of truth.** Supabase migrations are not in the repo. The schema in §3 is inferred from Supabase client calls. Before adding new tables, confirm canonical schema with whoever owns the Supabase project.
12. **`gpt-image-2` model parameter knobs.** No `quality`, `style`, or `background` parameters are passed today. Should the new pipeline set these explicitly (e.g. `quality: "high"`, `background: "auto"`)?
13. **Consent flow.** [facely/hooks/useTenByTenConsent.tsx](facely/hooks/useTenByTenConsent.tsx) gates ten-by-ten with a one-time consent modal. Is the new pipeline subject to the same consent, a fresh one, or none?
14. **Output size.** Always `1024x1024`. Source photo is `aspect: [3,4]` from ImagePicker. The square output crops; the 3:4 viewer letterboxes. If the new pipeline keeps a portrait aspect, we'd need a different gpt-image-2 size or post-crop.
15. **Insights `gpt-4o-mini` lacks `response_format: json_object`** — is that intentional (because the prompt asks for JSON anyway) or a bug we should fix in the same change?
