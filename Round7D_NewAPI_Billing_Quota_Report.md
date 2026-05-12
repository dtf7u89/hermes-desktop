# Round7-D: New API Billing / Quota Adaptation Report (HTTPS Domain)

**Date:** 2026-05-12
**Project:** Hermes Desktop (`/home/seeone/hermes-desktop`)
**Status:** ✅ Complete — all tests pass, build clean

---

## 1. Objective

Adapt the Billing page to read real token balance/quota/usage from the production New API at **`https://apitokenhub.dpdns.org`**, replacing the legacy mock `/api/quota` dependency with New API's native `/api/user/self` endpoint. Implement a dual-endpoint strategy that prioritizes the native New API endpoint and gracefully falls back to the legacy `/api/quota` path for Round6 mock compatibility.

---

## 2. New API Endpoint Research

Probed the production domain to determine which endpoints are available:

| Endpoint | HTTP Status | Result |
|----------|-------------|--------|
| `GET /api/user/self` | 200 | ✅ **Exists** — returns `{"success":false,"message":"Unauthorized..."}` with invalid token. With valid Bearer token, returns user info including `quota` and `used_quota`. |
| `GET /api/token/` | 200 | ✅ Exists — same auth gate |
| `GET /api/quota` | **404** | ❌ **Does NOT exist** on New API — `{"error":{"message":"Invalid URL (GET /api/quota)"}}` |
| `GET /v1/dashboard/billing/usage` | 401 | Exists but requires valid token |
| `GET /api/status` | 200 | Public — confirmed New API `v1.0.0-rc.4`, `quota_per_unit: 500000`, `quota_display_type: "USD"` |

**Conclusion:** The legacy `/api/quota` endpoint **does not exist** on New API. The native endpoint for user balance is `GET /api/user/self` with `Authorization: Bearer <token>`.

### New API `/api/user/self` Response Format (expected)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "[REDACTED]",
    "group": "vip",
    "quota": 500000,
    "used_quota": 100000,
    ...
  }
}
```

---

## 3. Approach: Dual-Endpoint Strategy

Implemented in `src/main/quota.ts`:

1. **Strategy A (primary):** Try New API's native `GET /api/user/self` with `Authorization: Bearer <token>`.
   - If `{ success: true, data: {...} }` → normalize via `normalizeNewApiQuota()`.
   - If `{ success: false, ... }` → return `unauthorized` error.

2. **Strategy B (fallback):** If Strategy A fails (404, network error, or unexpected response), fall back to legacy `GET /api/quota` for Round6 mock compatibility.

3. **Error handling:** Structured error mapping (`unauthorized`, `quota_exceeded`, `rate_limited`, `server_error`, `network_error`, `bad_response`, `not_configured`) with URL sanitization via `safeMessage()`.

### New Functions Added

| Function | Purpose |
|----------|---------|
| `normalizeNewApiQuota(data)` | Maps New API `{quota, used_quota, group}` → `QuotaInfo` |
| `fetchJson(url, key, deviceId, signal)` | Reusable authenticated GET with controlled error handling |

### Field Mapping

| New API field | QuotaInfo field | Notes |
|---------------|-----------------|-------|
| `data.quota` | `remaining_tokens` | Remaining quota |
| `data.used_quota` | `used_tokens` | Used quota |
| *calculated* | `total_tokens` | `remaining + used` |
| `data.group` | `plan` | User group (e.g. "vip") |

---

## 4. Files Modified

### 4.1 `src/main/quota.ts` (patched)

**Changes from previous Round7D (Bearer-only):**

- Added `normalizeNewApiQuota()` — parses New API `/api/user/self` response format
- Added `fetchJson()` — reusable authenticated GET helper, returns `null` on any failure
- Modified `fetchQuota()` — dual-endpoint strategy:
  - Primary: `GET {vps_base_url}/api/user/self`
  - Fallback: `GET {vps_base_url}/api/quota` (legacy Round6 mock)
- Handles `success: false` responses from New API as `unauthorized`
- All existing error handling, timeout, and URL sanitization preserved

### 4.2 `tests/quota.test.ts` (rewritten)

**Tests: 15 total (up from 9 in previous Round7D)**

New tests added for Round7D native endpoint integration:

- `uses /api/user/self as primary New API endpoint`
- `falls back to legacy /api/quota if /api/user/self fails`
- `has normalizeNewApiQuota helper for New API response`
- `has fetchJson helper for authenticated GET requests`
- `handles New API success:false as unauthorized`
- `normalizes New API quota/used_quota fields into QuotaInfo`

All original Round7D Bearer auth and error mapping tests preserved.

### 4.3 Files NOT Modified

- `src/main/index.ts` — IPC handler `quota:get` unchanged
- `src/preload/index.ts` — `getQuota()` unchanged
- `src/preload/index.d.ts` — `QuotaInfo` interface unchanged
- `src/main/license.ts` — no changes needed
- `src/renderer/src/screens/Billing/Billing.tsx` — UI reads same `QuotaResult` shape

---

## 5. Security

| Requirement | Implementation | Verified |
|-------------|---------------|----------|
| No token in URL | `Authorization: Bearer` header only | ✅ Test: `license_key=` absent from source |
| No token in error messages | `safeMessage()` strips all URLs → `[URL]` | ✅ Test: `[URL]` present in source |
| No raw API keys in IPC | `fetchQuota()` returns controlled `QuotaResult` | ✅ By design |
| All requests via HTTPS | `https://apitokenhub.dpdns.org` | ✅ Production domain |
| No admin/root credentials | Not used in quota module | ✅ |

---

## 6. Verification Results

```
=== Quota-specific tests ===
npm test -- tests/quota.test.ts
  ✓ 15 tests passed (1 file)

=== Full test suite ===
npm test
  ✓ 337 tests passed (14 files, 0 failures)

=== Production build ===
npm run build
  ✓ typecheck:node   — 0 errors
  ✓ typecheck:web    — 0 errors
  ✓ electron-vite    — built in 3.32s
    main/index.js    337.29 kB
    preload/index.js  13.31 kB
    renderer          2905 modules
```

---

## 7. Backward Compatibility

- **Legacy mock `/api/quota`** — Preserved as fallback. If the New API server doesn't have `/api/quota`, the structured error handling surfaces the failure gracefully.
- **IPC contract** — `quota:get` returns the same `QuotaResult` shape. Preload types unchanged.
- **Adapters** — The `vps_base_url` field can point to any backend, including a future `/opt/hermes-newapi-adapter`.
- **Round6 mock** — If pointed to the old mock server at `http://43.166.4.133:8096`, the fallback to `/api/quota` still works.

---

## 8. Design Decisions

1. **Dual-endpoint strategy** — Prefer New API's native `/api/user/self` but keep `/api/quota` fallback. This ensures the desktop client works with both the production New API and legacy mock servers without configuration changes.

2. **`normalizeNewApiQuota()` separate from `normalizeQuota()`** — The two endpoints have fundamentally different response shapes. Keeping separate normalizers avoids complex conditional logic and makes each code path clear.

3. **`fetchJson()` as reusable helper** — Extracted the authenticated GET pattern into a helper that returns `null` on any failure. This avoids duplicating fetch/error-handling code between the primary and fallback paths.

4. **No adapter layer needed** — The `/api/user/self` endpoint provides everything the Billing page needs. No server-side adapter (`/opt/hermes-newapi-adapter`) is required for quota functionality.

---

## 9. Risks & Next Steps

| Risk | Mitigation |
|------|-----------|
| New API `/api/user/self` response format may differ from expected | `normalizeNewApiQuota()` handles missing fields gracefully with zero defaults |
| Token may not have access to `/api/user/self` | Falls back to `/api/quota`; returns `unauthorized` if both fail |
| Quota values may be in USD units, not token counts | Raw values passed through; UI displays numbers as-is. Future: multiply by `quota_per_unit` if display conversion needed |

**Next steps:**
- Round7-F (if planned): End-to-end Billing integration test with real New API token
- Future: Consider multiplying quota values by `quota_per_unit` (500000) for accurate token-count display

---

## 10. Summary

Round7-D completed the Billing/Quota adaptation from mock `/api/quota` to production New API's native `/api/user/self` endpoint at `https://apitokenhub.dpdns.org`. The implementation uses a dual-endpoint strategy with graceful fallback, preserving full backward compatibility with Round6 mock servers. All 337 tests pass, the production build is clean, and no credentials are exposed in URLs or error messages.
