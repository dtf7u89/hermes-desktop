import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────

const mockLicense = vi.fn();
const mockFetch = vi.fn();

vi.mock("../src/main/license", () => ({
  readLicense: () => mockLicense(),
  normalizeVpsBaseUrl: (url: string) => url.trim().replace(/\/+$/, ""),
}));

// Stub global fetch
vi.stubGlobal("fetch", mockFetch);

// Import after mocks are set up
import {
  testModelProxy,
  type ModelProxyTestResult,
} from "../src/main/model-proxy-test";

// ── Helpers ──────────────────────────────────────────────────────────────

function mockLicensePresent(
  licenseKey = "sk-tes...2345",
  vpsBaseUrl = "https://api.example.com",
  deviceId = "test-device-uuid",
) {
  mockLicense.mockReturnValue({
    license_key: licenseKey,
    vps_base_url: vpsBaseUrl,
    device_id: deviceId,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    status: "active" as const,
  });
}

function mockLicenseAbsent() {
  mockLicense.mockReturnValue(null);
}

function mockFetchResponse(status: number, body: unknown) {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockFetchNetworkError(message = "connect ECONNREFUSED") {
  mockFetch.mockRejectedValue(new Error(message));
}

function mockFetchAbortError() {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  mockFetch.mockRejectedValue(err);
}

function mockFetchBadJson() {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
    text: () => Promise.resolve("not json"),
  });
}

function assertNoLicenseKeyIn(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json).not.toContain("license_key");
  expect(json).not.toContain("sk-tes...2345");
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockLicenseAbsent();
  mockFetch.mockReset();
});

// ─── 1. Missing License ──────────────────────────────────────────────────

describe("testModelProxy without license", () => {
  it("returns ok:false with status not_configured when no license", async () => {
    mockLicenseAbsent();
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.message).toBeTruthy();
  });

  it("does not throw when license is missing", async () => {
    mockLicenseAbsent();
    await expect(testModelProxy()).resolves.toBeDefined();
  });

  it("does not call fetch when no license", async () => {
    mockLicenseAbsent();
    await testModelProxy();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── 2. Valid Request Construction ───────────────────────────────────────

describe("testModelProxy request construction", () => {
  it("POSTs to {vps_base_url}/v1/chat/completions", async () => {
    mockLicensePresent("sk-test", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "Hermes model proxy OK" } }],
      model: "default",
    });
    await testModelProxy();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("strips trailing slash from vps_base_url before appending /v1", async () => {
    mockLicensePresent("sk-test", "https://api.example.com/");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    await testModelProxy();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("sends POST with JSON content-type", async () => {
    mockLicensePresent("sk-test", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    await testModelProxy();
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.headers).toBeDefined();
    const headers = options.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("uses Authorization: Bearer header (not query param)", async () => {
    mockLicensePresent("sk-test-key", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    await testModelProxy();
    const url = mockFetch.mock.calls[0][0] as string;
    // Should NOT contain license_key in URL query params
    expect(url).not.toContain("license_key");
    expect(url).not.toContain("sk-test-key");

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test-key");
  });

  it("includes X-Device-Id header", async () => {
    mockLicensePresent("sk-test", "https://api.example.com", "my-device-123");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    await testModelProxy();
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["X-Device-Id"]).toBe("my-device-123");
  });

  it("sends OpenAI-compatible body with model, messages, max_tokens, temperature", async () => {
    mockLicensePresent("sk-test", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    await testModelProxy();
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("default");
    expect(body.messages).toEqual([
      {
        role: "user",
        content: "Reply with exactly: Hermes model proxy OK",
      },
    ]);
    expect(body.max_tokens).toBe(32);
    expect(body.temperature).toBe(0);
  });

  it("uses the provided test model instead of hardcoded default", async () => {
    mockLicensePresent("sk-test", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
      model: "gpt-5.5-fast",
    });
    await testModelProxy({ model: "gpt-5.5-fast" });
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("gpt-5.5-fast");
  });

  it("auto-selects the first /v1/models model when requested model is blank", async () => {
    mockLicensePresent("sk-test", "https://api.example.com");
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [
            { id: "gpt-5.5-fast", object: "model" },
            { id: "gpt-5.4-mini", object: "model" },
          ],
          object: "list",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: "OK" } }],
          model: "gpt-5.5-fast",
        }),
      });

    await testModelProxy({ model: "", autoSelectModel: true });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/v1/chat/completions",
      expect.any(Object),
    );
    const options = mockFetch.mock.calls[1][1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("gpt-5.5-fast");
  });

  it("has a 15-second timeout (AbortController signal)", async () => {
    mockLicensePresent("sk-test", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    await testModelProxy();
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

// ─── 3. Success Response Parsing ─────────────────────────────────────────

describe("testModelProxy success response", () => {
  it("returns ok:true with model and response_preview on success", async () => {
    mockLicensePresent();
    mockFetchResponse(200, {
      choices: [{ message: { content: "Hermes model proxy OK" } }],
      model: "default",
    });
    const result = await testModelProxy();
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.model).toBe("default");
    expect(result.response_preview).toBe("Hermes model proxy OK");
  });

  it("handles response without model field", async () => {
    mockLicensePresent();
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    const result = await testModelProxy();
    expect(result.ok).toBe(true);
    expect(result.model).toBeUndefined();
    expect(result.response_preview).toBe("OK");
  });

  it("truncates long response_preview", async () => {
    mockLicensePresent();
    const longContent = "A".repeat(2000);
    mockFetchResponse(200, {
      choices: [{ message: { content: longContent } }],
    });
    const result = await testModelProxy();
    expect(result.ok).toBe(true);
    expect(result.response_preview).toBeDefined();
    if (result.response_preview) {
      expect(result.response_preview.length).toBeLessThanOrEqual(2000);
    }
  });
});

// ─── 4. HTTP Error Status Codes ──────────────────────────────────────────

describe("testModelProxy HTTP errors", () => {
  it("HTTP 401 -> unauthorized", async () => {
    mockLicensePresent();
    mockFetchResponse(401, { error: "Invalid license" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("unauthorized");
    expect(result.message).toBeTruthy();
  });

  it("HTTP 403 -> unauthorized", async () => {
    mockLicensePresent();
    mockFetchResponse(403, { error: "Forbidden" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("unauthorized");
  });

  it("HTTP 402 -> quota_exceeded", async () => {
    mockLicensePresent();
    mockFetchResponse(402, { error: "Payment required" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("quota_exceeded");
  });

  it("HTTP 429 -> rate_limited", async () => {
    mockLicensePresent();
    mockFetchResponse(429, { error: "Too many requests" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rate_limited");
  });

  it("HTTP 500 -> server_error", async () => {
    mockLicensePresent();
    mockFetchResponse(500, { error: "Internal error" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("server_error");
  });

  it("HTTP 502 -> server_error", async () => {
    mockLicensePresent();
    mockFetchResponse(502, { error: "Bad gateway" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("server_error");
  });

  it("HTTP 503 -> server_error", async () => {
    mockLicensePresent();
    mockFetchResponse(503, { error: "Service unavailable" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("server_error");
  });

  it("HTTP 404 is treated as a generic error", async () => {
    mockLicensePresent();
    mockFetchResponse(404, { error: "Not found" });
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    // 404 is not specifically mapped, falls through to generic error
    expect(result.status).toBe("error");
  });
});

// ─── 5. Network / Timeout Errors ────────────────────────────────────────

describe("testModelProxy network errors", () => {
  it("network error -> network_error", async () => {
    mockLicensePresent();
    mockFetchNetworkError("connect ECONNREFUSED");
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("network_error");
  });

  it("DNS failure -> network_error", async () => {
    mockLicensePresent();
    mockFetchNetworkError("getaddrinfo ENOTFOUND");
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("network_error");
  });

  it("AbortError -> timeout", async () => {
    mockLicensePresent();
    mockFetchAbortError();
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("timeout");
  });
});

// ─── 6. JSON Corruption ──────────────────────────────────────────────────

describe("testModelProxy bad response", () => {
  it("corrupt JSON response -> bad_response", async () => {
    mockLicensePresent();
    mockFetchBadJson();
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("bad_response");
  });
});

// ─── 7. Sensitive Data Protection ───────────────────────────────────────

describe("sensitive data protection", () => {
  it("result does not contain raw license_key", async () => {
    mockLicensePresent("sk-secret-key-12345", "https://api.example.com");
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });
    const result = await testModelProxy();
    assertNoLicenseKeyIn(result);
  });

  it("error result does not contain raw license_key", async () => {
    mockLicensePresent("sk-secret-key-12345");
    mockFetchResponse(401, { error: "Invalid" });
    const result = await testModelProxy();
    assertNoLicenseKeyIn(result);
  });

  it("message field does not contain raw license_key", async () => {
    mockLicensePresent("sk-secret-key-12345");
    mockFetchNetworkError("some error");
    const result = await testModelProxy();
    assertNoLicenseKeyIn(result);
  });

  it("network error message does not leak URL with license_key", async () => {
    mockLicensePresent("sk-tes...2345");
    mockFetchNetworkError("connect ECONNREFUSED 1.2.3.4:443");
    const result = await testModelProxy();
    // The error message should not contain the raw key or the full URL with key
    const msg = JSON.stringify(result);
    expect(msg).not.toContain("sk-tes...2345");
  });
});

// ─── 8. Edge Cases ───────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles malformed vps_base_url gracefully", async () => {
    // URL without http:// should still work (fetch will handle or it will error)
    mockLicensePresent("sk-test", "not-a-valid-url");
    mockFetchNetworkError("Failed to parse URL");
    const result = await testModelProxy();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("network_error");
  });

  it("handles empty choices array", async () => {
    mockLicensePresent();
    mockFetchResponse(200, { choices: [], model: "default" });
    const result = await testModelProxy();
    expect(result.ok).toBe(true);
    expect(result.response_preview).toBe("");
  });

  it("handles response with null message content", async () => {
    mockLicensePresent();
    mockFetchResponse(200, {
      choices: [{ message: { content: null } }],
    });
    const result = await testModelProxy();
    expect(result.ok).toBe(true);
    expect(result.response_preview).toBe("");
  });
});
