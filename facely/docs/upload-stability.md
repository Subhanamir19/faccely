# Upload stability hardening

## What changed and why
- **Deterministic media normalization:** All capture/gallery selections now pass through `ensureJpegCompressed`, resizing to a max width of 1080px and compressing to JPEG (~80%). This keeps uploads predictable and strips HEIC surprises that previously stalled Android uploads.
- **Stronger network client:** `fetchWithRetry` wraps every scoring request with a 45s timeout on Android emulators (30s elsewhere) and exponential backoff for transient aborts. Multipart requests log their payload sizes and runtime so we can trace slow paths.
- **Clearer user feedback:** Upload timeouts surface as `upload_timeout` errors with actionable hints instead of generic aborts. 413/415 responses bubble up with readable explanations.
- **Backend capacity tweaks:** The scorer API accepts 20 MB files, enforces a 120 s server timeout, emits structured request logs, and responds with JSON hints for oversize/unsupported uploads.

## Testing checklist
1. **Android emulator:**
   - Launch the Expo client and take/gallery-pick two large (≈12 MP) photos.
   - Confirm the loading screen completes within ~45 s and logs show `normalizedSize` plus upload duration.
2. **Physical device (iOS + Android):**
   - Repeat the pair upload; verify no AbortError appears and results render normally.
   - Test airplane-mode/offline to ensure timeout messaging remains clear.
3. **Backend sanity:**
   - Start the scorer service (`npm run dev` inside `scorer-node`).
   - Upload a >20 MB file and observe the `payload_too_large` JSON response.

## cURL example
```
curl -X POST "$API_BASE/analyze/pair" \
  -H "Accept: application/json" \
  -F "frontal=@/path/to/front.jpg;type=image/jpeg" \
  -F "side=@/path/to/side.jpg;type=image/jpeg"
```
Expect a JSON payload with normalized score metrics.