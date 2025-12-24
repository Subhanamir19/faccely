# Tasks Screen (Program Day) - Fonts + Design Specs

This is a repo-grounded spec to implement the preferred Tasks screen UI (Program Day detail) as pixel-perfect as possible within the existing design system.

## Fonts (what the repo actually uses)

Bundled fonts:
- `facely/assets/fonts/Poppins-SemiBold.ttf` (loaded in `facely/app/_layout.tsx`)

Default text component:
- `facely/components/ui/T.tsx` wraps React Native `Text` and forces `fontFamily: "Poppins-SemiBold"` for all usage of `T`.

Important caveat (blocks truly pixel-perfect body text):
- Multiple screens reference `Poppins-Regular` in styles, but there is no `Poppins-Regular.ttf` in `facely/assets/fonts/`.
- Many screens import `Text` from `react-native` instead of using `T`, so they render with system fonts unless `fontFamily` is set.

Production-grade expectation for the preferred UI:
- Add `Poppins-Regular.ttf` (and optionally `Poppins-Medium.ttf`) to `facely/assets/fonts/`.
- Load them in `facely/app/_layout.tsx` via `useFonts`.
- Use:
  - `Poppins-SemiBold` for titles, buttons, key labels
  - `Poppins-Regular` (or Medium) for body/secondary copy and pill metadata

## Design tokens (source of truth)

From `facely/lib/tokens.ts`:

Colors:
- Background gradient: `COLORS.bgTop` `#000000`, `COLORS.bgBottom` `#0B0B0B`
- Card: `COLORS.card` `rgba(18,18,18,0.90)`
- Card border: `COLORS.cardBorder` `rgba(255,255,255,0.08)`
- Text: `COLORS.text` `#FFFFFF`
- Secondary text: `COLORS.sub` `rgba(160,160,160,0.80)`
- Accent: `COLORS.accent` `#B4F34D`
- Track: `COLORS.track` `#2A2A2A`

Radii:
- `RADII.lg` `18` (default card radius)
- `RADII.md` `14` (inner surfaces)
- `RADII.pill` `28` (chips/pills/buttons)
- `RADII.circle` `999`

Spacing:
- `SP[1]=4`, `SP[2]=8`, `SP[3]=12`, `SP[4]=16`, `SP[5]=20`, `SP[6]=24`

Screen padding pattern:
- `facely/components/layout/Screen.tsx` applies `paddingHorizontal: SP[4]` (16) and a background gradient.

## Preferred Tasks screen UI spec (what to match)

Target screen: `facely/app/program/[day].tsx`

### Header
- Left: back pill (icon + "Back"), height ~44-48, radius `RADII.pill`, background `rgba(255,255,255,0.08)` or `COLORS.whiteGlass`.
- Center: `Day N` title (largest text on the screen).
  - Font: `Poppins-SemiBold`
  - Size: 24-28
  - Color: `COLORS.text`
- Right: `~X min total` (small).
  - Font: `Poppins-Regular`
  - Size: 12-13
  - Color: `COLORS.sub`

### Phase/Focus block (under title)
- Phase line: `Phase 1 - Foundation`
  - Size: 12-13, `COLORS.sub`
- Focus line: `Focus: ...`
  - Size: 12-13, `COLORS.sub`

### "Today's routine..." banner
- Container:
  - Radius: `RADII.lg` (or `RADII.xl` if it reads better)
  - Border: 1px with a muted accent tint
  - Fill: `rgba(180,243,77,0.08)` (matches the current banner style)
- Left icon: green check inside a small circle
- Text: 1-2 lines
  - Color: `COLORS.accent`

### Exercise cards (list)

Card container:
- Background: `COLORS.card`
- Border: 1px `COLORS.cardBorder`
- Radius: `RADII.lg`
- Padding: `SP[3]` to `SP[4]`
- Gap between cards: `SP[2]` to `SP[3]`

Left column:
- Title: `Poppins-SemiBold`, 15-16, `COLORS.text`
- Metadata pill: `role - intensity` (optionally include targets)
  - Background: `COLORS.whiteGlass` or `rgba(255,255,255,0.06)`
  - Radius: `RADII.pill`
  - Text: `Poppins-Regular`, 11-12, `COLORS.sub`
- One-line summary (short, not the full protocol)
  - `Poppins-Regular`, 12-13, `COLORS.sub`, 1 line

Right column:
- Start pill button:
  - Height: ~34-40
  - Radius: `RADII.pill`
  - Fill: `COLORS.accent` (or slightly muted if needed)
  - Text: `Poppins-SemiBold`, 14-16, `#0B0B0B`
- Completion indicator circle:
  - Size: ~22-26
  - Not complete: outline only
  - Complete: filled accent + check mark

## Interaction rules (must remain functional)

- Entire card press opens the action modal.
- Start button opens the preview/perform flow.
- Completion indicator reflects `useProgramStore().completions` keys.
- "Mark as complete" must not toggle a completed exercise back to incomplete.

## Implementation notes (repo patterns)

- Prefer `Screen` (`facely/components/layout/Screen.tsx`) for consistent padding + background.
- Prefer `T` for consistent `Poppins-SemiBold` until `Poppins-Regular` is properly loaded.
- For true visual parity with the preferred UI, add `Poppins-Regular.ttf` and introduce a regular-weight text component (or allow `T` to accept a weight prop).

