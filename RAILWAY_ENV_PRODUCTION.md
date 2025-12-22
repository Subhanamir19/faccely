# Railway Production Environment Variables

## Critical Configuration for Production Deployment

Update these environment variables in Railway **immediately** before going live:

### 1. OpenAI API Key (CRITICAL - CURRENTLY INVALID)
```
OPENAI_API_KEY=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
```
**Status**: ✅ Verified working (tested 2025-12-22)

### 2. Clerk Authentication (CRITICAL - CURRENTLY WRONG)
```
CLERK_ISSUER=https://rare-moccasin-14.clerk.accounts.dev
CLERK_JWKS_URL=https://rare-moccasin-14.clerk.accounts.dev/.well-known/jwks.json
```
**Status**: ⚠️ Railway still has OLD values (sought-bluejay-56)

### 3. Redis (Already Configured)
```
REDIS_URL=redis://default:smZfXGdYtchkQktKfOtuqeyALpHbtdwM@redis.railway.internal:6379
```
**Status**: ✅ Already correct in Railway

### 4. Supabase (Already Configured)
```
SUPABASE_URL=https://gvenukjkgcxvwxerwpak.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZW51a2prZ2N4dnd4ZXJ3cGFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDE4MjMxMywiZXhwIjoyMDc5NzU4MzEzfQ.BLd0yZYnEqawxT0cGVm-bdD-XizB7ogK4_ydCFW6jwk
```
**Status**: ✅ Should be correct in Railway

### 5. Node Environment
```
NODE_ENV=production
```
**Status**: ⚠️ Verify this is set to "production" in Railway

### 6. Performance & Rate Limiting
```
PORT=8080
CORS_ORIGINS=*
RATE_LIMIT_PER_MIN=300
MAX_CONCURRENT=20
REQUEST_QUEUE_MAX_WAIT_MS=20000
```

### 7. Cache TTLs (seconds)
```
CACHE_TTL_ANALYZE_S=3600
CACHE_TTL_EXPLAIN_S=7200
CACHE_TTL_ROUTINE_S=604800
IDEMPOTENCY_TTL_S=900
```

### 8. Service Metadata
```
SERVICE_NAME=scorer-node
SERVICE_VERSION=0.1.0
```

### 9. Feature Flags
```
FF_ASYNC_ANALYZE=0
FF_ASYNC_ROUTINE=0
FF_ALLOW_HEADER_IDENTITY=true
```

---

## Deployment Checklist

- [ ] Update `OPENAI_API_KEY` in Railway (copy from local .env)
- [ ] Update `CLERK_ISSUER` to `https://rare-moccasin-14.clerk.accounts.dev`
- [ ] Update `CLERK_JWKS_URL` to `https://rare-moccasin-14.clerk.accounts.dev/.well-known/jwks.json`
- [ ] Verify `NODE_ENV=production`
- [ ] Trigger Railway redeploy
- [ ] Test authentication with frontend
- [ ] Test analyze/pair endpoint
- [ ] Monitor Railway logs for errors

---

## How to Update in Railway

1. Go to your Railway project dashboard
2. Click on the `scorer-node` service
3. Go to the "Variables" tab
4. Update the following variables:
   - `OPENAI_API_KEY` → (paste the key above)
   - `CLERK_ISSUER` → `https://rare-moccasin-14.clerk.accounts.dev`
   - `CLERK_JWKS_URL` → `https://rare-moccasin-14.clerk.accounts.dev/.well-known/jwks.json`
5. Click "Deploy" or wait for auto-deploy
6. Monitor deployment logs

---

## Current Issues

### Issue 1: Invalid OpenAI API Key
**Error**: `401 Incorrect API key provided: sk-proj-...ApcA`
**Fix**: The Railway deployment has an invalid/old OpenAI key. Update with the key above.

### Issue 2: Wrong Clerk Configuration
**Error**: Authentication will fail if Clerk config is wrong
**Fix**: Railway still points to `sought-bluejay-56.clerk.accounts.dev` (old app). Must update to `rare-moccasin-14.clerk.accounts.dev`.

---

## Post-Deployment Verification

After updating environment variables and redeploying:

1. **Check logs for startup**:
   ```
   [BOOT] { env: 'production', service: { name: 'scorer-node', version: '0.1.0' } }
   [REDIS] ready
   [QUEUES] workers started
   ```

2. **Test health endpoint**:
   ```bash
   curl https://your-railway-url.railway.app/health
   ```

3. **Test authentication** (from frontend):
   - Sign in with Clerk
   - Make analyze/pair request
   - Should see `[auth] jwtVerify success` in logs

4. **Test OpenAI integration**:
   - Upload images
   - Should NOT see `401 Incorrect API key` errors
   - Should see successful scores returned

---

## Emergency Rollback

If deployment fails:
1. Check Railway logs for specific error
2. Revert environment variables to previous values
3. Redeploy
4. Contact support if persistent issues
