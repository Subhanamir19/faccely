# Hide “Protocols” Completely (Facely App) — Repo Playbook

Goal: hide the Protocols feature for **all builds** so it **does not appear anywhere in the app** and is **not reachable** via UI, deep links, or programmatic navigation. We are **not deleting** the feature code; we are removing all access paths.

Also required: on the Analysis screen, the last-card footer button currently labeled **“Protocols”** must become **“Tasks”** and navigate to the **Program** screen.

---

## What “complete hide” means in this repo

This app uses **Expo Router** (`facely`), which auto-registers routes from the filesystem under `facely/app`.

If a file exists at `facely/app/**/protocols.tsx`, it becomes a route (even if it’s not in the tab bar). Therefore, a production-grade “cannot be accessed” hide must ensure:

- No Protocols entry points in UI (tabs/buttons/links).
- No navigation code pushes to the Protocols route.
- No Protocols route exists in the router (so deep links and manual navigation can’t resolve it).

---

## Protocols surface area (found via `rg` / file scan)

### Mobile app (Expo / React Native) — `facely`

User-facing entry points (must change):
- `facely/app/(tabs)/_layout.tsx` (Protocols tab is visible here)
- `facely/app/(tabs)/analysis.tsx` (last-card button triggers protocols regeneration + navigates to Protocols)
- `facely/app/(tabs)/protocols.tsx` (this file defines the Protocols route/screen)

Feature implementation (keep, but becomes unreachable):
- `facely/store/protocolsStore.ts` (Zustand store; persisted under `sigma_protocols_v1`)
- `facely/lib/api/protocols.ts` (client API call to `POST /protocols`)

Non-user-facing mention (usually safe to keep):
- `facely/app/(tabs)/routine.tsx` includes a prompt string containing “protocols” (not a UI entry point)

### Backend — `scorer-node` (FYI)

Protocols endpoint still exists:
- `scorer-node/src/index.ts` mounts `app.use("/protocols", ...)`
- `scorer-node/src/routes/protocols.ts` implements `POST /protocols`

This playbook does **not** remove backend functionality; it only ensures the mobile app does not expose it.

---

## Recommended implementation (hard hide; cannot be reached)

### 1) Remove the Protocols route from Expo Router (without deleting code)

Because Expo Router derives routes from filenames, the simplest reversible approach is to rename the route file so it is **ignored** as a route.

Action:
- Rename `facely/app/(tabs)/protocols.tsx` → `facely/app/(tabs)/_protocols.tsx`

Notes:
- Expo Router ignores files starting with `_` (private/non-route).
- Do **not** rename to `protocols.disabled.tsx` or similar; that would still create a route (e.g., `/protocols.disabled`).
- After this rename, **any deep link to `/protocols` must no longer resolve**.

### 2) Remove Protocols from the tab bar

File:
- `facely/app/(tabs)/_layout.tsx`

Actions:
- Remove the `<Tabs.Screen name="protocols" ... />` block entirely.
- Remove `Ionicons` import if it becomes unused after removing the Protocols tab.
- Keep other tabs unchanged.

### 3) Replace “Protocols” button on Analysis screen with “Tasks” → Program screen

File:
- `facely/app/(tabs)/analysis.tsx`

Current behavior:
- On last card: `onNext` calls `handleProtocols()`, which regenerates protocols and navigates to `/(tabs)/protocols`.
- `nextLabel` becomes `"Protocols"` on the last card.

Required behavior:
- On last card: `onNext` navigates to Program screen.
  - Use the existing tab route: `/(tabs)/program`
- Button label on last card must be `"Tasks"`.

Actions:
- Remove `useProtocolsStore` import and all Protocols regeneration logic (no more `handleProtocols`).
- Remove any “Couldn't generate protocols.” alerts (no longer relevant).
- Replace footer props so that:
  - `onNext={() => (isLast ? nav.push(\"/(tabs)/program\") : goTo(idx + 1))}`
  - `nextLabel={isLast ? \"Tasks\" : \"Next\"}`
  - Remove `nextDisabled={pLoading}` (or replace with a relevant disable condition if needed).

### 4) Ensure no remaining navigation path exists

After steps (1)-(3), verify there are **zero** references to the Protocols route.

Suggested checks:
- From repo root: `rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' \"\\/(?:\\(tabs\\)\\/protocols|protocols)\\b\" facely/app facely/components facely/lib facely/store`
- Confirm no files remain at `facely/app/**/protocols.tsx`.

---

## Optional hardening (only if you want “defense in depth”)

These are not strictly required if the route file is removed, but they can help prevent accidental reintroduction.

- Add a single feature flag constant (compile-time):
  - Example: `facely/lib/features.ts` exporting `export const FEATURES = { protocols: false } as const;`
  - Use it to conditionally render any future Protocols entry points.
  - This does **not** enable remote toggling without a new app build (because the route file is absent).

- If later you decide Protocols should be remotely enabled without shipping a new build:
  - You **cannot** remove the route file.
  - Instead, keep the route but hard-block it (redirect/404) based on a runtime flag.
  - This is incompatible with the current “deep links must not resolve at all” requirement.

---

## Validation checklist (production-grade)

Minimum:
- App launches; Tabs render without errors (no missing `Tabs.Screen` names).
- No “Protocols” label appears in UI (tab bar, buttons, headers).
- Attempting to navigate to `/protocols` (deep link) results in an unmatched route (no Protocols screen shown).
- Analysis footer last-card button reads “Tasks” and navigates to Program tab (`/(tabs)/program`).

Useful local commands (run from `facely/`):
- `npm run start` (manual navigation smoke test)
- `npx tsc -p tsconfig.json --noEmit` (typecheck, if configured)

---

## Quick revert (when Protocols is ready again)

- Rename `facely/app/(tabs)/_protocols.tsx` → `facely/app/(tabs)/protocols.tsx`
- Restore `<Tabs.Screen name=\"protocols\" ... />` in `facely/app/(tabs)/_layout.tsx`
- Decide whether Analysis last-card button should stay as “Tasks” or revert to “Protocols”

