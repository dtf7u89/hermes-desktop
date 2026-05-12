import { readLicense, normalizeVpsBaseUrl } from "./license";

// ── Types ────────────────────────────────────────────────────────────────

export interface ModelProxyTestOptions {
  model?: string;
  autoSelectModel?: boolean;
}

export interface ModelProxyTestResult {
  ok: boolean;
  status?: string;
  message?: string;
  model?: string;
  response_preview?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

function buildProxyUrl(vpsBaseUrl: string): string {
  const normalized = normalizeVpsBaseUrl(vpsBaseUrl);
  return `${normalized}/v1/chat/completions`;
}

function buildModelsUrl(vpsBaseUrl: string): string {
  const normalized = normalizeVpsBaseUrl(vpsBaseUrl);
  return `${normalized}/v1/models`;
}

function statusFromHttp(status: number): string {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 402) return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "error";
}

function extractContent(body: Record<string, unknown>): string {
  const choices = body.choices as Array<{ message?: { content?: string | null } }> | undefined;
  if (!choices || !Array.isArray(choices) || choices.length === 0) return "";
  const content = choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function safeMessage(base: string, err: Error): string {
  // Never include the raw error message if it might contain a URL with the key
  const msg = err.message || "Unknown error";
  // Remove URLs from error messages to prevent key leakage
  const cleaned = msg.replace(/https?:\/\/[^\s]*/g, "[URL]");
  return `${base}: ${cleaned}`;
}

async function fetchFirstAvailableModel(
  vpsBaseUrl: string,
  licenseKey: string,
  deviceId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetch(buildModelsUrl(vpsBaseUrl), {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${licenseKey}`,
      "X-Device-Id": deviceId,
    },
  });

  if (!response.ok) return null;

  const parsed = (await response.json()) as { data?: Array<{ id?: unknown }> };
  const models = Array.isArray(parsed.data) ? parsed.data : [];
  const first = models.find((item) => typeof item.id === "string" && item.id.trim());
  return typeof first?.id === "string" ? first.id.trim() : null;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Test the model proxy connection.
 *
 * Reads the saved license, then makes a POST request to the VPS
 * /v1/chat/completions endpoint with an OpenAI-compatible test payload.
 *
 * Uses Authorization: Bearer header — never passes the license key
 * as a query parameter.
 *
 * Returns a controlled result.  Never throws or exposes raw secrets
 * to the renderer.
 */
export async function testModelProxy(
  options: ModelProxyTestOptions = {},
): Promise<ModelProxyTestResult> {
  const license = readLicense();

  if (!license) {
    return {
      ok: false,
      status: "not_configured",
      message: "No license configuration found. Please save a license first.",
    };
  }

  const url = buildProxyUrl(license.vps_base_url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const requestedModel = options.model?.trim();
    let selectedModel = requestedModel || "default";

    if (!requestedModel && options.autoSelectModel) {
      const autoModel = await fetchFirstAvailableModel(
        license.vps_base_url,
        license.license_key,
        license.device_id,
        controller.signal,
      );
      selectedModel = autoModel || selectedModel;
    }

    const body = JSON.stringify({
      model: selectedModel,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: Hermes model proxy OK",
        },
      ],
      max_tokens: 32,
      temperature: 0,
    });

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${license.license_key}`,
        "X-Device-Id": license.device_id,
      },
      body,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        status: statusFromHttp(response.status),
        message: `Model proxy test failed: HTTP ${response.status}`,
      };
    }

    const parsed = (await response.json()) as Record<string, unknown>;
    const content = extractContent(parsed);
    const model = (parsed.model as string | undefined) ?? undefined;

    // Truncate response preview to avoid huge payloads
    const preview = content.length > 2000 ? content.slice(0, 2000) : content;

    return {
      ok: true,
      status: "ok",
      model,
      response_preview: preview,
    };
  } catch (err) {
    const error = err as Error & { name?: string };

    // Distinguish timeout (AbortError) from network errors
    if (error.name === "AbortError") {
      return {
        ok: false,
        status: "timeout",
        message: "Model proxy test timed out after 15 seconds.",
      };
    }

    // JSON parse error (HTTP 200 but body was not valid JSON)
    if (error instanceof SyntaxError) {
      return {
        ok: false,
        status: "bad_response",
        message: "Model proxy returned an invalid JSON response.",
      };
    }

    // Network errors (DNS, connection refused, etc.)
    return {
      ok: false,
      status: "network_error",
      message: safeMessage("Model proxy test failed", error),
    };
  }
}
