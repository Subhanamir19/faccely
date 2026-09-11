# iOS bundle size optimization

Log of the asset/bundle work. Every number below comes from
`npx expo export --platform ios --no-minify`, measured before and after each
change, not from folder sizes on disk.

## Baseline

| | |
|---|---|
| Export total | **123.4 MB** |
| JS bundle (`.hbc`) | 20.4 MB |
| Assets | 103.4 MB |

Source `assets/` holds 207.8 MB, but Metro only bundles what is actually
`require()`d — 118.6 MB of it never entered the build. The folder size was
never the shipped size.

Two findings that were not visible from the folder listing:

- `assets/new-exercises-images/*.embedded.json` (13.1 MB) carry their frames
  base64-inlined. A required `.json` is inlined into the JS bundle rather than
  written to the asset store, so this sat inside the 20 MB bundle. Production
  uses exactly one of them; the rest were referenced only by the dev preview
  screen.
- 163 image files live **outside** `assets/` (`advanced-analysis-icons/`,
  `routine-poses/`), contributing ~21 MB.

## Changes

### 1. Dev-only Lottie previews excluded from release bundles — −9.5 MB

The dev screen's preview catalogue was moved out of `app/(tabs)/dev.tsx` into
`lib/devLottiePreviews.ts`, with `lib/devLottiePreviews.prod.ts` as a stub.
`metro.config.js` swaps the module at resolve time when
`NODE_ENV=production`.

It must live outside `app/`: expo-router runs `require.context()` over that
whole tree, so a module there is bundled even when nothing imports it. That is
why the first attempt (`app/(tabs)/dev.lottiePreviews.ts`) saved only 0.5 MB —
verified by grepping the built `.hbc` for `data:image/png;base64`, which still
found 22 occurrences. After the move: 1.

Dev builds are untouched — the preview screen works exactly as before.

Bundle: 20.4 MB → 10.9 MB.

### 2. Opaque PNG → JPEG — −18.7 MB

18 shipped PNGs had no alpha channel at all. JPEG q92-96, 4:4:4 chroma
(no subsampling, so edges stay crisp), progressive.

React Native's `<Image>` decodes JPEG natively, so this is a file swap plus a
`require()` path change — no component changes, no new dependency.

Quality gate: encoded at q92, measured against the original, and re-encoded at
higher quality if mean absolute error exceeded 0.9/255. Every file passed at
q92 or q96. Worst case MAE 0.889/255; largest single-pixel deviation 39/255 on
one edge.

21.5 MB → 2.8 MB across 16 files (the two app-icon PNGs were excluded).
21 `require()` paths updated across 8 files.

### 3. Icon fonts: deep imports — −2.4 MB

`import { Ionicons } from "@expo/vector-icons"` pulls the barrel, which
requires every icon set's `.ttf`. 12 files switched to
`@expo/vector-icons/Ionicons` style deep imports.

Bundled icon fonts: 20 files → 2 (MaterialCommunityIcons, Ionicons).

### 4. Google fonts: per-weight imports — −2.5 MB

`@expo-google-fonts/poppins` barrel ships all 18 weights for the 3 the app
renders. Switched to per-weight subpaths
(`@expo-google-fonts/poppins/400Regular`), same for Fredoka. `useFonts` now
comes from `expo-font` directly.

### 5. Onboarding art → WebP — −10.1 MB

`PlanImpactScreen` already renders through `expo-image`, which decodes WebP on
iOS, so its 9 images converted with no component change and no new dependency.
13.0 MB → 2.9 MB.

Measuring this correctly matters. A naive RGBA comparison reported MAE 2.7-3.5,
which looks alarming — but that counts RGB values in fully transparent pixels,
which WebP legitimately discards and nobody can see. Compared the way a user
sees it (alpha channel exact, RGB composited over both white and black): alpha
error **0.000**, visible RGB error **≤0.71/255**.

### 6. Dead `require()`s — −1.6 MB

`PROGRESS_MILESTONE_IMAGE` and `POTENTIAL_STAGE_IMAGE` in `dashboard.tsx` were
declared and never rendered. An unused `require()` still bundles its asset.

### 7. PNG palette quantization, in place — −38 MB

The largest single win, and the one with no code change at all: files stay
`.png`, every `require()` untouched. 76 referenced PNGs re-encoded to a 256
colour palette (FASTOCTREE, best of dithered/undithered per file).

Gates applied per file before anything was written — alpha error ≤0.7, visible
RGB error ≤2.0/255, size reduction ≥30%. 29 files missed a gate and were left
byte-identical, including `chin-projection-new.png`, whose gradients pushed
error to 25/255.

Applied: 42.0 MB → 3.8 MB. Worst visible error across all 76: **1.96/255**
(0.8%). At that level the difference is invisible until amplified 8x.

App icons, the adaptive icon and the splash image were excluded by name and
never touched.

## Running total

| Stage | Export total |
|---|---|
| Baseline | 123.4 MB |
| After dev Lottie swap | 114.4 MB |
| After JPEG conversion | 95.7 MB |
| After icon-font deep imports | 93.3 MB |
| After per-weight font imports | 90.8 MB |
| After WebP + dead requires + quantization | **48.5 MB** |

**−74.9 MB (−61%)**, with no asset deleted, no asset moved to a CDN, and no
perceptible quality change. Every `require()` still resolves — the export
itself is the proof, since Metro fails the build on an unresolved asset.

## Not done, and why

- **Font subsetting** (SF-Pro-Rounded, 6.75 MB). Subsetting risks tofu on any
  glyph outside the subset — user-entered names, accented characters — and the
  SF Pro licence deserves review before it goes near a subsetting tool.
- **Byte-identical duplicates.** 9 groups exist in `assets/`, but only 3 have
  both copies referenced. Real saving is ~0.4 MB, not worth touching call
  sites for.
- **Remote/CDN hosting.** At this size the offline-behaviour complexity costs
  more than the bytes are worth.

## Verify after any of this

- Onboarding: gender, ethnicity, time-dedication backgrounds render.
- Onboarding feature sequence: the five diet plate images render.
- Scan tab and onboarding scan: both capture guide images render.
- Program: exercise pose images in the routine list and session.
- Dev build: the dev tab's Lottie preview screen still lists and plays.
- Every screen with icons: no missing glyph boxes.
