# Supabase Anonymous-by-Default Auth Plan (Facely + Scorer-Node)

This file contains a **runbook** (authoritative) followed by **legacy notes** (superseded). If anything conflicts, follow the runbook.

---

## Runbook (ASCII authoritative)

### Scope

- Replace Clerk entirely with Supabase Auth (anonymous + email/password).
- On app launch: restore session; if none, sign in anonymously.
- No auth prompts until the user attempts premium/subscribe.
- Keep the existing route `/(auth)/login`:
  - anonymous user -> upgrade to email/password (same user id)
  - returning user -> sign in with email/password
- Backend `scorer-node` verifies Supabase JWTs and derives identity only from verified JWT claims.
- "Delete account" clears local caches only (no remote deletes).
- "Sign out" signs out then immediately signs in anonymously again (new anonymous user id).

### Invariants (do not break)

- Identity source of truth is JWT `sub` (and optional `email`).
- Do not regenerate anonymous user id on every app open:
  - call `supabase.auth.getSession()` first
  - only call `supabase.auth.signInAnonymously()` if there is no session
- Upgrade must not change user id:
  - upgrade anonymous to email/password must keep `session.user.id` identical pre/post upgrade

### Supabase Dashboard steps (must do first)

1. Auth -> Providers: enable "Anonymous"
2. Auth -> Providers: enable "Email"
3. Auth -> Settings (or Email settings): disable "Confirm email"
4. Collect:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. Backend JWT verify reference (important):
   - Supabase access tokens are `HS256` signed (shared secret), so JWKS is empty.
   - Collect the **JWT secret** from Supabase Dashboard:
     - Project Settings -> API -> JWT Settings -> `JWT Secret`
   - issuer: `https://<project-ref>.supabase.co/auth/v1`
   - audience: `authenticated`

### Environment variables (exact names)

facely:

- Add to `facely/.env` and `facely/.env.example`:
  - `EXPO_PUBLIC_SUPABASE_URL=...`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
- Remove after cutover:
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_CLERK_JWT_TEMPLATE` (if present)

scorer-node:

- Existing:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Add (for JWT verification):
  - `SUPABASE_JWT_SECRET=<dashboard JWT secret>`
  - `SUPABASE_ISSUER=${SUPABASE_URL}/auth/v1`
  - `SUPABASE_AUDIENCE=authenticated`
- Remove after cutover:
  - `CLERK_JWKS_URL`, `CLERK_ISSUER`, `CLERK_AUDIENCE`

### Implementation tasks (file-by-file)

Backend (`scorer-node`):

- `scorer-node/src/config/index.ts`
  - Add env validation for `SUPABASE_JWT_SECRET`, `SUPABASE_ISSUER`, `SUPABASE_AUDIENCE`.
  - Remove Clerk env requirements.
- `scorer-node/src/middleware/auth.ts`
  - Verify Supabase JWT from `Authorization: Bearer <jwt>` using Supabase `JWT Secret` + issuer/audience.
  - Set:
    - `res.locals.userId = payload.sub`
    - `res.locals.email = payload.email` (if present)
  - Remove/disable header identity fallback (`x-user-id`, etc.).

App (`facely`):

- Dependencies
  - Add `@supabase/supabase-js`.
  - If you see `ReferenceError: URL is not defined` in Expo/React Native, also add `react-native-url-polyfill` and import `react-native-url-polyfill/auto` in `facely/index.ts`.
- `facely/lib/supabase/client.ts`
  - Create and export a singleton `supabase` using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Configure auth storage to use AsyncStorage and persist sessions.
- `facely/providers/AuthProvider.tsx`
  - Remove Clerk usage.
  - On mount: `getSession()`; if none, `signInAnonymously()` once.
  - Subscribe to `onAuthStateChange` and keep auth store in sync.
- `facely/store/auth.ts`
  - Add/track: `initialized`, `isAnonymous`, `uid`, `idToken`, `user.email`.
  - Treat anonymous as authenticated (no steady logged-out state).
  - Implement logout helper: signOut then signInAnonymously.
- `facely/lib/api/tokenProvider.ts` and `facely/lib/api/authHeaders.ts`
  - Replace Clerk token plumbing with Supabase session token retrieval.
  - `buildAuthHeadersAsync()` must return `Authorization: Bearer <supabase_access_token>`.
  - Do not trust `x-user-id` as identity.
- `facely/app/(auth)/login.tsx`
  - Replace Clerk login with Supabase.
  - If anonymous: upgrade via `supabase.auth.updateUser({ email, password })` (user id must not change).
  - Else: sign in via `supabase.auth.signInWithPassword({ email, password })`.
  - Support `redirectTo` param after success.
  - Handle "email already registered" during upgrade by switching to sign-in mode.
- `facely/app/(tabs)/profile.tsx`
  - Remove Clerk signOut.
  - Log out: signOut then signInAnonymously (no navigation to login).
  - Delete account: clear local stores only, then signOut then signInAnonymously.
- `facely/lib/auth/requireUpgrade.ts`
  - If `isAnonymous`, route to `/(auth)/login` with `redirectTo=<premium>`.
  - Wire this helper into the future "Subscribe" action (stub is fine for now).

### Clerk removal checklist (must complete)

1. Remove `ClerkProvider` and `tokenCache` from `facely/app/_layout.tsx`.
2. Remove `@clerk/clerk-expo` from `facely/package.json` and update `facely/package-lock.json`.
3. Remove `EXPO_PUBLIC_CLERK_*` from `facely/.env` and `facely/.env.example`.
4. Remove `CLERK_*` from `scorer-node` config/env.
5. Sanity search (must return nothing):
   - `Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx -Path facely,scorer-node | Select-String -Pattern "@clerk|ClerkProvider|EXPO_PUBLIC_CLERK|CLERK_JWKS_URL|CLERK_ISSUER|CLERK_AUDIENCE"`

### Execution order (exact)

1. Supabase Dashboard settings.
2. scorer-node JWT verification cutover (remove header identity fallback).
3. facely: add Supabase client + env vars (and polyfill if needed).
4. facely: AuthProvider + auth store updates (restore session; else anonymous).
5. facely: replace API auth headers/token provider.
6. facely: rewrite `/(auth)/login` for upgrade/sign-in.
7. facely: update Profile logout/delete flows.
8. Remove Clerk dependencies/env and sanity search for leftovers.
9. Validate manually (below).

### Validation (manual test script)

1. Fresh install / cleared storage: launch app, no login UI, `isAnonymous=true`.
2. Restart: launch again, `uid` unchanged.
3. API call: run a scorer-node-backed flow (analyze/history), succeeds.
4. Log out: becomes anonymous again, `uid` changes, no login screen.
5. Upgrade: go to `/(auth)/login` while anonymous, create email+password, `uid` stays the same.
6. Backend security: missing/invalid bearer token returns 401; spoofed `x-user-id` is not accepted.

---

## Runbook (legacy formatting; ignore)

### Scope

- Replace Clerk entirely with Supabase Auth (anonymous + email/password).
- App silently restores a Supabase session on launch; if none exists, it signs in anonymously.
- App stays usable without auth prompts until the user attempts premium/subscribe.
- Use the existing route `/(auth)/login` for both:
  - upgrading an anonymous user to email/password (same user id), and
  - signing in returning users with email/password.
- Update `scorer-node` to verify Supabase JWTs and derive identity exclusively from the verified JWT.
- “Delete account” is local-only (clear cached local data; do not delete remote rows).
- “Sign out” immediately returns to anonymous (no logged-out UI state).

### Non-goals

- RevenueCat integration (we only add a “require upgrade” gate/stub).
- Migration of existing Clerk users (there are no real users yet).
- Designing Supabase RLS policies (the backend uses service role; auth is enforced in the API layer).
- Remote deletion / GDPR deletion workflows.

### Concepts (must be true in the implementation)

- **User id** is always the verified JWT `sub` claim (also `session.user.id`). Never accept a user id from the client.
- **Anonymous user id is stable across restarts**:
  - try `supabase.auth.getSession()` first
  - only call `supabase.auth.signInAnonymously()` if there is no session
- **Upgrade must not change user id**:
  - upgrade anonymous → email/password must attach credentials to the same user id (no new account)

### Supabase Dashboard steps (do first)

1. Enable Anonymous sign-ins
   - Dashboard → Auth → Providers → enable “Anonymous”.
2. Enable Email provider
   - Dashboard → Auth → Providers → enable “Email”.
3. Disable email confirmation (for now)
   - Dashboard → Auth → Settings (or Email provider settings) → disable “Confirm email”.
4. Record values for env:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. Backend JWT verification reference:
   - Supabase access tokens are `HS256` signed with your project's **JWT secret** (JWKS is empty).
   - JWT Secret: Project Settings -> API -> JWT Settings -> `JWT Secret`
   - Issuer: `https://<project-ref>.supabase.co/auth/v1`
   - Audience: `authenticated`

### Definition of Done (agent must satisfy all items)

Functional:

1. Fresh install: app launches without auth UI and has an authenticated Supabase session (anonymous).
2. Restart: session restores and anonymous user id stays the same.
3. Sign out: app returns to anonymous automatically (no login screen) and user id changes.
4. Upgrade: from anonymous, `/(auth)/login` upgrades in-place and user id does not change.
5. Returning sign-in: user can sign in with email/password on a new install.
6. All API calls to `scorer-node` succeed using Supabase JWTs.

Security:

1. `scorer-node` rejects requests with missing/invalid bearer token.
2. `scorer-node` does not accept identity from `x-user-id`/`x-email` headers.
3. `scorer-node` derives identity only from verified JWT claims (`sub`, optional `email`).

Cleanup:

1. No remaining `@clerk/*` imports/usages in `facely/`.
2. No `EXPO_PUBLIC_CLERK_*` usage in `facely/`.
3. No `CLERK_*` usage in `scorer-node/`.

### Environment variables (exact names to implement)

facely (Expo):

- Add to `facely/.env` and `facely/.env.example`:
  - `EXPO_PUBLIC_SUPABASE_URL=<https://...supabase.co>`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
- Remove after cutover:
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_CLERK_JWT_TEMPLATE` (if present)

scorer-node:

- Already required:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Add for Supabase JWT verification (use these exact names):
  - `SUPABASE_JWT_SECRET=<dashboard JWT secret>`
  - `SUPABASE_ISSUER=${SUPABASE_URL}/auth/v1`
  - `SUPABASE_AUDIENCE=authenticated`
- Remove after cutover:
  - `CLERK_JWKS_URL`, `CLERK_ISSUER`, `CLERK_AUDIENCE`

### Implementation steps (explicit file-by-file)

Backend (`scorer-node`):

1. `scorer-node/src/config/index.ts`
   - Add env validation for `SUPABASE_JWT_SECRET`, `SUPABASE_ISSUER`, `SUPABASE_AUDIENCE`.
   - Remove Clerk env requirements.
2. `scorer-node/src/middleware/auth.ts`
   - Replace Clerk JWT verification with Supabase JWT verification.
    - Use `Authorization: Bearer <jwt>` only.
   - Set identity:
     - `res.locals.userId = payload.sub`
     - `res.locals.email = payload.email` (if present)
   - Remove/disable any header identity fallback (`x-user-id`, etc.).

App (`facely`):

1. Add Supabase client
   - Add dependency `@supabase/supabase-js` (and `react-native-url-polyfill` only if needed).
   - Create `facely/lib/supabase/client.ts` exporting a singleton `supabase`.
     - Must use AsyncStorage session persistence.
     - Must use `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - If needed, add `import "react-native-url-polyfill/auto";` to `facely/index.ts`.
2. Replace auth bootstrap
   - Rewrite `facely/providers/AuthProvider.tsx`:
     - restore session via `supabase.auth.getSession()`
     - if absent, call `supabase.auth.signInAnonymously()` once
     - subscribe to `supabase.auth.onAuthStateChange`
     - keep zustand auth store updated (uid/idToken/email/isAnonymous/initialized)
3. Replace API auth headers
   - Update `facely/lib/api/authHeaders.ts` and `facely/lib/api/tokenProvider.ts` so:
     - `buildAuthHeadersAsync()` returns `Authorization: Bearer <supabase_access_token>`
     - no Clerk token provider remains
     - do not send identity headers as a source of truth
4. Rewrite `/(auth)/login` (same route)
   - Rewrite `facely/app/(auth)/login.tsx` to support:
     - anonymous upgrade: `supabase.auth.updateUser({ email, password })`
     - sign in: `supabase.auth.signInWithPassword({ email, password })`
     - redirect via `redirectTo` param
     - handle “email already registered” during upgrade by switching to sign-in
5. Update Profile screen behavior
   - Update `facely/app/(tabs)/profile.tsx`:
     - remove Clerk signOut
     - “Log out”: `supabase.auth.signOut()` then `supabase.auth.signInAnonymously()` (no login screen)
     - “Delete account”: clear local stores only, then sign out → sign in anonymously
6. Add subscribe gate stub (for later RevenueCat)
   - Add `facely/lib/auth/requireUpgrade.ts`
     - if `isAnonymous`, route to `/(auth)/login?redirectTo=<premium>`

### Clerk removal checklist (must complete)

1. Remove `ClerkProvider` and related key checks from `facely/app/_layout.tsx`.
2. Remove `@clerk/clerk-expo` from `facely/package.json` and update `facely/package-lock.json`.
3. Remove `EXPO_PUBLIC_CLERK_*` from `facely/.env` and `facely/.env.example`.
4. Remove `CLERK_*` from `scorer-node` config/env.
5. Sanity search (must return nothing):
   - `Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx -Path facely,scorer-node | Select-String -Pattern "@clerk|ClerkProvider|EXPO_PUBLIC_CLERK|CLERK_JWKS_URL|CLERK_ISSUER|CLERK_AUDIENCE"`

### Execution order (exact)

1. Supabase Dashboard: enable Anonymous + Email; disable email confirmation.
2. scorer-node: implement Supabase JWT verification and remove header identity fallback.
3. facely: add Supabase client + env vars (and URL polyfill if needed).
4. facely: implement Supabase AuthProvider bootstrap (restore session → anonymous fallback).
5. facely: update auth header builder to use Supabase access tokens.
6. facely: rewrite `/(auth)/login` for Supabase login + anonymous upgrade.
7. facely: update Profile logout/delete flows.
8. facely + scorer-node: remove Clerk deps/env and sanity search for leftovers.
9. Run validation checklist.

### Validation (manual test script)

1. Fresh install / cleared storage
   - Launch app: no auth UI; confirm `isAnonymous=true`.
2. Restart app
   - Relaunch: confirm `uid` is unchanged.
3. Exercise API calls
   - Run a flow that calls `scorer-node` (analyze/history/etc.): succeeds.
4. Sign out
   - Tap “Log out”: confirm new anonymous identity (uid changes) and no login screen.
5. Upgrade
   - Trigger subscribe gate (or navigate to `/(auth)/login`) while anonymous.
   - Enter email+password: upgrade succeeds; confirm `uid` stays the same pre/post upgrade.
6. Backend security checks
   - Missing/invalid bearer token: backend returns 401.
   - Spoofed `x-user-id` without a valid JWT: backend returns 401 and does not set identity.

---

## Legacy notes (superseded)

## Goal (legacy; ignore)

- Remove Clerk entirely.
- On app launch, silently create/restore a Supabase session via **anonymous sign-in**.
- Keep the app fully usable while anonymous (no auth prompts).
- When the user attempts to subscribe (RevenueCat later), route to `/(auth)/login` to **upgrade** the current anonymous account to **email+password** (same user id), then continue.
- Update `scorer-node` to **verify Supabase JWTs** and derive identity from the JWT only.

## Big Picture: How It Works

### What “anonymous auth” really is

- Anonymous users are still “real authenticated users” in Supabase Auth.
- They receive:
  - `user_id` (JWT `sub`, typically a UUID string)
  - an authenticated session with an `access_token` (JWT)
- They just don’t have an email/password identity attached yet.

### Critical invariant (do not break)

- When upgrading anonymous → email/password, **do not create a new account**.
- The upgrade must attach email/password to the existing anonymous user so that:
  - `user_id` stays the same
  - all rows in Supabase keyed to that `user_id` remain accessible

### User flow

1. App opens → silent anonymous session created/restored.
2. User uses app normally; all data saves under the anonymous `user_id`.
3. User taps “Subscribe” → app routes to `/(auth)/login`.
4. Login screen upgrades anonymous account to email/password (or signs in existing user).
5. After login/upgrade, return to subscription flow (when implemented).

### Important: anonymous ID is NOT regenerated every launch

- The app must first try to **restore an existing Supabase session** (`supabase.auth.getSession()`).
- Only if there is **no session** (fresh install, storage cleared, etc.) should it call `supabase.auth.signInAnonymously()`.
- Result: the anonymous `user_id` remains stable across normal app restarts.
- A new anonymous `user_id` is created only when:
  - the user signs out (you sign out and then sign in anonymously again),
  - the app storage is cleared / the app is reinstalled,
  - or the session becomes unrecoverable/invalid.

### “Sign out” and “Delete account” (requested behavior)

- **Sign out**: sign out of Supabase, then immediately sign in anonymously again.
  - This will create a **new** anonymous `user_id` and effectively starts a fresh identity.
- **Delete account**: clear local cached state only, then sign out → sign in anonymously.
  - Remote data will remain in Supabase (orphaned), by design for now.

## Supabase Dashboard Checklist (Do First)

1. **Enable Anonymous sign-ins**
   - Supabase Dashboard → Auth → Providers → enable **Anonymous**.
2. **Enable Email provider**
   - Supabase Dashboard → Auth → Providers → enable **Email**.
3. **Disable email confirmation**
   - Supabase Dashboard → Auth → Settings (or Email provider settings) → turn OFF “Confirm email”.
4. **Collect values for env**
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. **Backend JWT verification settings**
   - Supabase access tokens are `HS256` signed with the project **JWT secret** (JWKS is empty).
   - JWT Secret: Project Settings -> API -> JWT Settings -> `JWT Secret`
   - Issuer: `https://<project-ref>.supabase.co/auth/v1`
   - Audience: `authenticated`

## Backend Changes (scorer-node): Verify Supabase JWTs

### Current state (what exists)

- `scorer-node/src/middleware/auth.ts` verifies Clerk tokens via JWKS and may optionally accept identity via headers (`x-user-id`, etc.).
- Routes depend on `res.locals.userId` (good), e.g. `scorer-node/src/routes/users.ts`.
- Supabase DB access uses the **service role** (`scorer-node/src/supabase/client.ts`).

### Required changes

1. **Add config/env for Supabase JWT verification**
   - In `scorer-node/src/config/index.ts`, add (names may vary):
     - `SUPABASE_URL` (already present/used elsewhere)
     - `SUPABASE_JWT_SECRET` (from Supabase dashboard)
     - `SUPABASE_ISSUER` (or derive from `SUPABASE_URL`)
     - `SUPABASE_AUDIENCE` (default `authenticated`)
2. **Replace Clerk verification with Supabase verification**
   - Update `scorer-node/src/middleware/auth.ts`:
     - Parse `Authorization: Bearer <jwt>`
     - Verify with Supabase `JWT Secret` + issuer + audience
     - Set identity from claims:
       - `res.locals.userId = payload.sub`
       - `res.locals.email = payload.email` (if present)
3. **Remove/disable header fallback identity**
   - Do not accept `x-user-id`/`x-email` as identity in production.
   - The JWT is the only source of truth for identity.
4. **Keep route contracts stable**
   - No changes needed to route handlers that already use `res.locals.userId`.

### Why this is crucial

- The app is client-side; anything in headers besides the JWT can be spoofed.
- With Supabase Auth, the JWT `sub` is the authoritative user id.

## App Changes (facely): Supabase Auth + Anonymous by Default

### Files/patterns to replace (current state)

- Clerk provider in `facely/app/_layout.tsx`.
- Clerk-driven auth bootstrap in `facely/providers/AuthProvider.tsx`.
- Clerk token plumbing:
  - `facely/lib/api/tokenProvider.ts`
  - `facely/lib/api/authHeaders.ts`
- Clerk login UI in `facely/app/(auth)/login.tsx`.
- Profile currently uses Clerk signOut: `facely/app/(tabs)/profile.tsx`.

### Clerk removal checklist (explicit)

Do these only after Supabase auth is fully wired and working end-to-end.

1. Remove Clerk provider wiring
   - Update `facely/app/_layout.tsx`:
     - Remove `ClerkProvider` and `tokenCache` imports/usages.
     - Remove publishable key checks for `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
2. Remove Clerk usage from screens/components
   - Update `facely/providers/AuthProvider.tsx` to use Supabase instead of:
     - `useAuth`, `useSession`, `useUser` from `@clerk/clerk-expo`.
   - Update `facely/app/(auth)/login.tsx` to remove all Clerk logic and debug calls:
     - `useSignIn`, `useSignUp`, `getClerkInstance`, etc.
   - Update `facely/app/(tabs)/profile.tsx` to remove `useAuth` from Clerk.
3. Remove Clerk token plumbing
   - Replace/retire `facely/lib/api/tokenProvider.ts` and ensure nothing calls Clerk token getters.
   - Replace `facely/lib/api/authHeaders.ts` to source tokens from Supabase.
4. Remove Clerk dependencies
   - Update `facely/package.json` to remove:
     - `@clerk/clerk-expo`
     - `@clerk/clerk-expo/token-cache` usage (if present)
   - Run `npm install` in `facely/` to update `package-lock.json`.
5. Remove Clerk environment variables
   - Remove from `facely/.env` and `facely/.env.example`:
     - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `EXPO_PUBLIC_CLERK_JWT_TEMPLATE` (if present)
6. Backend: stop referencing Clerk env
   - Update `scorer-node/src/config/index.ts` and `scorer-node/src/middleware/auth.ts` so `CLERK_*` vars are no longer required.
7. Sanity search (should return nothing)
   - Search for `@clerk` / `Clerk` / `EXPO_PUBLIC_CLERK` and remove remaining references.

### Add Supabase client

1. Install:
   - `@supabase/supabase-js`
2. Add:
   - `facely/lib/supabase/client.ts`
   - Use `createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)` with React Native storage (AsyncStorage) + session persistence.
3. Add env vars:
   - `facely/.env` and `facely/.env.example`:
     - `EXPO_PUBLIC_SUPABASE_URL=...`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`

### Replace AuthProvider with Supabase bootstrapping

Rewrite `facely/providers/AuthProvider.tsx` to:

1. On mount:
   - `supabase.auth.getSession()`
   - If no session: `supabase.auth.signInAnonymously()`
2. Subscribe to auth changes:
   - `supabase.auth.onAuthStateChange(...)`
3. Keep auth store updated with:
   - `uid = session.user.id`
   - `email = session.user.email ?? null`
   - `idToken = session.access_token`
   - `status = "authenticated"` when session exists (including anonymous)
   - `isAnonymous = session.user.is_anonymous` (or derive)
4. Set the app as “initialized” once a session exists or a failure is handled.

### Token handling for API calls

Update `facely/lib/api/authHeaders.ts` and related code to:

- Use Supabase session `access_token` for `Authorization: Bearer ...`.
- Do not rely on `x-user-id` header for identity.
- If you keep `x-device-id`, treat it as metadata only (non-authoritative).

### Rewrite `/(auth)/login` to support login + upgrade

Rewrite `facely/app/(auth)/login.tsx` behavior:

- If current user is anonymous:
  - Upgrade via `supabase.auth.updateUser({ email, password })`
  - This keeps the same `user_id` (critical).
- If user is not anonymous:
  - Login via `supabase.auth.signInWithPassword({ email, password })`
- After success:
  - call `syncUserProfile()` (existing) to upsert `public.users`
  - redirect to `redirectTo` param or default route

Edge case:
- If upgrade returns “email already registered”, switch UI to “Sign in instead”.

### Update Profile screen logout/delete behavior

Update `facely/app/(tabs)/profile.tsx`:

- Remove Clerk usage.
- “Log out”:
  - `supabase.auth.signOut()`
  - immediately `supabase.auth.signInAnonymously()`
  - do not navigate to `/(auth)/login`
- “Delete account” (local-only):
  - clear local stores (existing `resetLocalUserData()`)
  - `supabase.auth.signOut()` then `signInAnonymously()`
  - do not call backend delete

### Add a “require upgrade” gate for premium actions (RevenueCat later)

Add a small helper (example path):
- `facely/lib/auth/requireUpgrade.ts`

Behavior:
- If `isAnonymous` is true: route to `/(auth)/login` with a `redirectTo` param
- Else: proceed to subscription/premium flow

This keeps your “no auth prompts until subscribe” rule consistent.

## Database Notes (No users exist yet)

- Your current schema uses `text` ids (originally “Clerk user id”).
- Supabase Auth user ids are UUID strings; they can be stored in `text` columns safely.
- Optional future improvement (not required now):
  - Convert ids to `uuid` and reference `auth.users(id)` with FKs.

## Step-by-Step Execution Order (Avoid breaking the app)

1. Supabase Dashboard: enable Anonymous + Email, disable email confirmation.
2. Backend: implement Supabase JWT verification (disable header fallback identity).
3. App: add Supabase client + env variables.
4. App: rewrite AuthProvider to sign in anonymously on launch and store session/JWT.
5. App: update auth header builder to use Supabase JWT.
6. App: rewrite `/(auth)/login` for Supabase login + anonymous upgrade.
7. App: update Profile logout/delete flows to match requirements.
8. App: remove Clerk provider wiring and Clerk deps/env.
9. Validate end-to-end with the checklist below.

## Validation Checklist (Must Pass)

1. Fresh install
   - App opens without auth UI.
   - Auth store shows authenticated session + `isAnonymous=true`.
2. App restart
   - Same anonymous session is restored (same `uid`).
3. API calls
   - Requests include `Authorization: Bearer <supabase_jwt>`.
   - Backend accepts and uses JWT `sub` as `userId`.
4. Log out
   - Returns to anonymous automatically (no login screen).
   - New anonymous `uid` is generated.
5. Upgrade (manual test via `/(auth)/login`)
   - From anonymous, create email+password.
   - `uid` remains the same after upgrade.
   - Existing history/data remains accessible.
6. Security sanity check
   - Backend rejects requests with missing/invalid bearer token.
   - Backend does not accept spoofed `x-user-id` identity.
