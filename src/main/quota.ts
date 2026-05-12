import { readLicense } from "./license";

export interface QuotaInfo {
  total_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  reset_at?: string | null;
  renew_url?: string | null;
  plan?: string | null;
  status?: string;
}

export interface QuotaResult {
  ok: boolean;
  quota?: QuotaInfo;
  message?: string;
  status?: string;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeQuota(body: Record<string, unknown>): QuotaInfo {
  const total = toNumber(body.total_tokens ?? body.totalTokens ?? body.total);
  const used = toNumber(body.used_tokens ?? body.usedTokens ?? body.used);
  const remainingValue = body.remaining_tokens ?? body.remainingTokens ?? body.remaining;
  const remaining =
    remainingValue === undefined || remainingValue === null
      ? Math.max(total - used, 0)
      : toNumber(remainingValue);

  return {
    total_tokens: total,
    used_tokens: used,
    remaining_tokens: remaining,
    reset_at: (body.reset_at as string | null | undefined) ?? null,
    renew_url: (body.renew_url as string | null | undefined) ?? null,
    plan: (body.plan as string | null | undefined) ?? null,
    status: (body.status as string | undefined) ?? undefined,
  };
}

/**
 * Map HTTP status codes to structured error categories.
 * Shared with model-proxy-test.ts for consistency.
 */
function statusFromHttp(status: number): string {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 402) return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "error";
}

/**
 * Sanitize error messages: strip URLs to prevent token/license key leakage.
 * Any URL in an error message could embed the license_key as a query param.
 */
function safeMessage(base: string, err: Error): string {
  const msg = err.message || "Unknown error";
  const cleaned = msg.replace(/https?:\/\/[^\s]*/g, "[URL]");
  return `${base}: ${cleaned}`;
}

/**
 * Normalize New API /api/user/self response into QuotaInfo.
 *
 * Expected response shape:
 *   { success: true, data: { quota: number, used_quota: number, group?: string } }
 *
 * Mapping:
 *   data.quota      → remaining_tokens
 *   data.used_quota → used_tokens
 *   total_tokens    = remaining + used (calculated)
 *   data.group      → plan
 */
function normalizeNewApiQuota(data: Record<string, unknown>): QuotaInfo {
  const remaining = toNumber(data.quota);
  const used = toNumber(data.used_quota);
  const total = remaining + used;

  return {
    total_tokens: total,
    used_tokens: used,
    remaining_tokens: remaining,
    reset_at: null,
    renew_url: null,
    plan: (data.group as string | undefined) ?? null,
    status: remaining > 0 ? "active" : "quota_exceeded",
  };
}

/**
 * Make an authenticated GET request and return the parsed JSON body.
 * Returns null if the request fails (non-2xx, network error, or JSON parse error).
 */
async function fetchJson(
  url: string,
  licenseKey: string,
  deviceId: string,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${licenseKey}`,
        "X-Device-Id": deviceId,
      },
    });

    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Fetch quota from the configured New API endpoint.
 *
 * Strategy (dual-endpoint with graceful fallback):
 *   1. Try New API's native GET /api/user/self (Bearer auth).
 *   2. If it returns { success: true, data: {...} }, normalize via normalizeNewApiQuota().
 *   3. If /api/user/self fails (404, network error, or success !== true),
 *      fall back to legacy GET /api/quota for Round6 mock compatibility.
 *   4. If both fail, return a structured error.
 *
 * Never passes the license key as a query parameter.
 *
 * Returns controlled errors instead of throwing so the Billing UI cannot crash.
 * Error status codes: not_configured, unauthorized, quota_exceeded,
 *   rate_limited, server_error, network_error, bad_response.
 */
export async function fetchQuota(): Promise<QuotaResult> {
  const config = readLicense();

  if (!config) {
    return {
      ok: false,
      status: "not_configured",
      message: "No license configuration found. Please save a license first.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const headers = {
      Accept: "application/json" as const,
      Authorization: `Bearer ${config.license_key}`,
      "X-Device-Id": config.device_id,
    };

    // ── Strategy A: New API native /api/user/self ─────────────────
    const newApiUrl = `${config.vps_base_url}/api/user/self`;
    const newApiBody = await fetchJson(newApiUrl, config.license_key, config.device_id, controller.signal);

    if (newApiBody && newApiBody.success === true && newApiBody.data && typeof newApiBody.data === "object") {
      clearTimeout(timeout);
      const data = newApiBody.data as Record<string, unknown>;
      return {
        ok: true,
        status: "ok",
        quota: normalizeNewApiQuota(data),
        message: (newApiBody.message as string | undefined) ?? undefined,
      };
    }

    // If /api/user/self returned an HTTP error response (non-2xx but valid JSON
    // with success: false), check for specific error codes.
    if (newApiBody && newApiBody.success === false) {
      clearTimeout(timeout);
      return {
        ok: false,
        status: "unauthorized",
        message: (newApiBody.message as string) || "New API returned an authorization error.",
      };
    }

    // ── Strategy B: Legacy /api/quota (Round6 mock compatibility) ──
    const legacyUrl = `${config.vps_base_url}/api/quota`;
    const response = await fetch(legacyUrl, {
      method: "GET",
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        status: statusFromHttp(response.status),
        message: `Failed to fetch quota: server returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as Record<string, unknown>;
    return {
      ok: true,
      status: (body.status as string | undefined) ?? "ok",
      quota: normalizeQuota(body),
      message: (body.message as string | undefined) ?? undefined,
    };
  } catch (err) {
    const error = err as Error & { name?: string };

    // Distinguish timeout (AbortError) from network errors
    if (error.name === "AbortError") {
      return {
        ok: false,
        status: "network_error",
        message: "Failed to fetch quota: request timed out.",
      };
    }

    // JSON parse error (HTTP 200 but body was not valid JSON)
    if (error instanceof SyntaxError) {
      return {
        ok: false,
        status: "bad_response",
        message: "Failed to fetch quota: invalid JSON response.",
      };
    }

    // Network errors (DNS, connection refused, etc.) — sanitize to prevent URL leakage
    return {
      ok: false,
      status: "network_error",
      message: safeMessage("Failed to fetch quota", error),
    };
  }
}
