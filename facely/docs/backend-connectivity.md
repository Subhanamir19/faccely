# Backend connectivity & configuration

Facely's mobile client talks to the scorer backend through the base URL that
resolves to `API_BASE` in [`lib/api/config.ts`](../lib/api/config.ts). The store
workflows (`store/scores.ts`) always perform a lightweight `/health` ping through
`pingHealth()` before any expensive upload (analysis, explanations, or
recommendations). When the base URL points to a placeholder host the ping fails
immediately, the store raises
`"Backend unreachable. Check API base (...) and network."`, and the UI surfaces
an "Analysis failed" dialog.

The repo previously shipped with a committed `.env` file containing the placeholder
`https://your-remote-api.example.com`, which Expo injects into the bundle as
`EXPO_PUBLIC_API_URL`. That meant every fresh install had a non-working API base,
causing the health check to fail before any request left the device.

## Resolution

1. `lib/api/config.ts` now normalises and validates the environment variable.
   Placeholder values (anything containing `your-remote-api.example.com` or an
   invalid scheme) are ignored so the app automatically falls back to the local
   development resolver that inspects the Metro host and, failing that, the
   usual simulator defaults. Android emulators always receive
   `http://10.0.2.2:8080` even when Metro advertises a LAN IP, ensuring the
   virtual device can hop back to the host machine. iOS simulators and web fall
   back to `http://localhost:8080`..
2. A checked-in `.env` is no longer used. Instead we provide `.env.example` with
   sane defaults and ignore the real `.env` in git. This prevents publishing a
   production bundle with the placeholder URL baked in.
3. Development builds log a clear message explaining which API base is active and
   when a fallback was applied. Production bundles also emit a warning if no
   explicit URL has been configured so the issue is caught during QA.

## How to configure the backend base URL

1. Copy `.env.example` to `.env` in the `facely/` directory.
2. For local development leave the default `http://localhost:8080` (or
   start Metro with `--tunnel` so physical devices can reach your machine and
   the auto-detected LAN IP will be used).
3. For a deployed backend set `EXPO_PUBLIC_API_URL` to the publicly reachable
   origin, e.g. `https://api.your-domain.com`.
4. Restart Expo after changing the variable so Metro rebuilds the bundle.

With these safeguards in place the analysis flow only fails when the backend is
truly unreachable, not because of a placeholder configuration.