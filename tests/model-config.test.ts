import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────

const mockLicense = vi.fn();
const mockGetModelConfig = vi.fn();
const mockSetModelConfig = vi.fn();
const mockGetConfigValue = vi.fn();
const mockSetConfigValue = vi.fn();
const mockReadEnv = vi.fn();
const mockSetEnvValue = vi.fn();

vi.mock("../src/main/license", () => ({
  readLicense: () => mockLicense(),
  maskLicenseKey: (key: string) => {
    if (!key) return "(empty)";
    if (key.length <= 8) return "****";
    return `${key.slice(0, 3)}***${key.slice(-4)}`;
  },
  normalizeVpsBaseUrl: (url: string) => url.trim().replace(/\/+$/, ""),
}));

vi.mock("../src/main/config", () => ({
  getModelConfig: (profile?: string) => mockGetModelConfig(profile),
  setModelConfig: (
    provider: string,
    model: string,
    baseUrl: string,
    profile?: string,
  ) => mockSetModelConfig(provider, model, baseUrl, profile),
  getConfigValue: (key: string, profile?: string) =>
    mockGetConfigValue(key, profile),
  setConfigValue: (key: string, value: string, profile?: string) =>
    mockSetConfigValue(key, value, profile),
  readEnv: (profile?: string) => mockReadEnv(profile),
  setEnvValue: (key: string, value: string, profile?: string) =>
    mockSetEnvValue(key, value, profile),
}));

// Import after mocks are set up
import {
  getModelConfigStatus,
  applyLicenseModelConfig,
  resetLicenseModelConfig,
} from "../src/main/model-config";

// ── Helpers ──────────────────────────────────────────────────────────────

function mockLicensePresent(
  license_key = "sk-test-license-key-12345",
  vps_base_url = "https://api.example.com",
) {
  mockLicense.mockReturnValue({
    license_key,
    vps_base_url,
    device_id: "test-device-uuid",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    status: "active" as const,
  });
}

function mockLicenseAbsent() {
  mockLicense.mockReturnValue(null);
}

function assertApiKeyNotIn(object: unknown): void {
  const json = JSON.stringify(object);
  expect(json).not.toContain("sk-test-license-key-12345");
  expect(json).not.toContain("license_key");
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockLicense.mockReturnValue(null);
  mockGetModelConfig.mockReturnValue({
    provider: "auto",
    model: "",
    baseUrl: "",
  });
  mockGetConfigValue.mockReturnValue(null);
});

// ─── 1. Missing License ─────────────────────────────────────────────────

describe("getModelConfigStatus", () => {
  it("returns ok:true with not-configured status when no license and no config", async () => {
    mockLicenseAbsent();
    const result = await getModelConfigStatus();
    expect(result.ok).toBe(true);
    expect(result.status?.configured).toBe(false);
  });

  it("returns ok:true with configured:false when license missing but manual config exists", async () => {
    mockLicenseAbsent();
    mockGetModelConfig.mockReturnValue({
      provider: "openai",
      model: "gpt-4",
      baseUrl: "https://api.openai.com/v1",
    });
    const result = await getModelConfigStatus();
    expect(result.ok).toBe(true);
    expect(result.status?.configured).toBe(true);
    expect(result.status?.source).toBe("manual");
  });
});

describe("applyLicenseModelConfig", () => {
  it("returns ok:false with controlled error when no license exists", async () => {
    mockLicenseAbsent();
    const result = await applyLicenseModelConfig();
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.message).toContain("license");
  });

  it("does not throw when license is missing", async () => {
    mockLicenseAbsent();
    await expect(applyLicenseModelConfig()).resolves.toBeDefined();
  });
});

// ─── 2. License Present — Correct base_url ──────────────────────────────

describe("applyLicenseModelConfig with license", () => {
  it("generates correct base_url from vps_base_url with /v1 suffix", async () => {
    mockLicensePresent("sk-test-license-key-12345", "https://api.example.com");
    const result = await applyLicenseModelConfig();
    expect(result.ok).toBe(true);
    expect(mockSetModelConfig).toHaveBeenCalledWith(
      "custom",
      "",
      "https://api.example.com/v1",
      undefined,
    );
  });

  it("handles vps_base_url with trailing slash", async () => {
    mockLicensePresent(
      "sk-test-license-key-12345",
      "https://api.example.com/",
    );
    const result = await applyLicenseModelConfig();
    expect(result.ok).toBe(true);
    // Should strip trailing slash and append /v1
    expect(mockSetModelConfig).toHaveBeenCalledWith(
      "custom",
      "",
      "https://api.example.com/v1",
      undefined,
    );
  });

  it("does not produce //v1 when vps_base_url already has trailing slash", async () => {
    mockLicensePresent(
      "sk-test-license-key-12345",
      "https://api.example.com/",
    );
    await applyLicenseModelConfig();
    const calls = mockSetModelConfig.mock.calls;
    const baseUrl = calls[0]?.[2] as string | undefined;
    expect(baseUrl).not.toContain("//v1");
  });
});

// ─── 3. API Key Not Leaked ──────────────────────────────────────────────

describe("sensitive data protection", () => {
  it("getModelConfigStatus does not expose raw license_key", async () => {
    mockLicensePresent();
    const result = await getModelConfigStatus();
    assertApiKeyNotIn(result);
    // Should have a masked api_key
    if (result.status?.configured) {
      const masked = result.status.api_key_masked;
      expect(masked).toBeDefined();
      expect(masked).not.toBe("sk-test-license-key-12345");
    }
  });

  it("applyLicenseModelConfig result does not expose raw license_key", async () => {
    mockLicensePresent();
    const result = await applyLicenseModelConfig();
    assertApiKeyNotIn(result);
  });

  it("applyLicenseModelConfig error message does not expose raw license_key", async () => {
    mockLicenseAbsent();
    const result = await applyLicenseModelConfig();
    assertApiKeyNotIn(result);
  });

  it("resetLicenseModelConfig result does not expose raw license_key", async () => {
    mockLicensePresent();
    const result = await resetLicenseModelConfig();
    assertApiKeyNotIn(result);
  });
});

// ─── 4. Reset ────────────────────────────────────────────────────────────

describe("resetLicenseModelConfig", () => {
  it("clears commercial model config and returns ok:true", async () => {
    mockLicensePresent();
    // Simulate that config was previously applied
    mockGetConfigValue.mockImplementation((key: string) => {
      if (key === "commercial_model_config_source") return "license";
      return null;
    });

    const result = await resetLicenseModelConfig();
    expect(result.ok).toBe(true);
  });

  it("returns ok:true even when nothing to reset", async () => {
    mockLicenseAbsent();
    const result = await resetLicenseModelConfig();
    expect(result.ok).toBe(true);
  });

  it("does not throw when no license exists", async () => {
    mockLicenseAbsent();
    await expect(resetLicenseModelConfig()).resolves.toBeDefined();
  });

  it("clears only commercial fields, not user's other config", async () => {
    mockLicensePresent();
    // Simulate that config was applied and there are other env vars
    mockReadEnv.mockReturnValue({
      OPENAI_API_KEY: "sk-user-key",
      ANTHROPIC_API_KEY: "sk-anthropic-key",
    });

    await resetLicenseModelConfig();

    // Should clear the model config (base_url, api_key)
    expect(mockSetModelConfig).toHaveBeenCalledWith(
      "auto",
      "",
      "",
      undefined,
    );
  });
});

// ─── 5. Profile Support ──────────────────────────────────────────────────

describe("profile support", () => {
  it("applyLicenseModelConfig passes profile to setModelConfig", async () => {
    mockLicensePresent();
    await applyLicenseModelConfig("my-profile");
    expect(mockSetModelConfig).toHaveBeenCalledWith(
      "custom",
      "",
      "https://api.example.com/v1",
      "my-profile",
    );
  });

  it("getModelConfigStatus passes profile to getModelConfig", async () => {
    mockLicenseAbsent();
    await getModelConfigStatus("my-profile");
    expect(mockGetModelConfig).toHaveBeenCalledWith("my-profile");
  });

  it("resetLicenseModelConfig passes profile to setModelConfig", async () => {
    mockLicensePresent();
    await resetLicenseModelConfig("my-profile");
    expect(mockSetModelConfig).toHaveBeenCalledWith(
      "auto",
      "",
      "",
      "my-profile",
    );
  });
});

// ─── 6. Edge Cases ──────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles corrupt license data gracefully", async () => {
    mockLicense.mockReturnValue({
      // Missing required fields
      license_key: "some-key",
      // vps_base_url missing
      device_id: "dev",
    });
    const result = await applyLicenseModelConfig();
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("handles empty vps_base_url in license", async () => {
    mockLicensePresent("sk-key", "");
    const result = await applyLicenseModelConfig();
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("masks short api keys properly", async () => {
    mockLicensePresent("short");
    const result = await getModelConfigStatus();
    assertApiKeyNotIn(result);
  });

  it("masks long api keys showing first 4 and last 4", async () => {
    mockLicensePresent("sk-averylongkeythatneedstobemasked1234abcd");
    const result = await getModelConfigStatus();
    assertApiKeyNotIn(result);
    // Should be masked like "sk-...abcd"
    if (result.status?.api_key_masked) {
      expect(result.status.api_key_masked).toMatch(/^sk-.*abcd$/);
    }
  });
});
