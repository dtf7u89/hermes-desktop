import { readLicense, normalizeVpsBaseUrl } from "./license";
import {
  getModelConfig,
  setModelConfig,
  getConfigValue,
  setConfigValue,
  setEnvValue,
} from "./config";

// ── Types ────────────────────────────────────────────────────────────────

export interface ModelConfigStatus {
  configured: boolean;
  base_url?: string;
  api_key_masked?: string;
  source?: "license" | "manual" | "unknown";
  message?: string;
}

export interface ModelConfigResult {
  ok: boolean;
  status?: ModelConfigStatus;
  message?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildBaseUrl(vpsBaseUrl: string): string {
  // Normalize: strip trailing slashes, then append /v1
  const normalized = normalizeVpsBaseUrl(vpsBaseUrl);
  return `${normalized}/v1`;
}

function validLicenseConfig(license: ReturnType<typeof readLicense>): license is NonNullable<ReturnType<typeof readLicense>> {
  if (!license) return false;
  if (!license.license_key || !license.license_key.trim()) return false;
  if (!license.vps_base_url || !license.vps_base_url.trim()) return false;
  return true;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Get the current model config status.
 * Reports whether a commercial model config is active, and returns
 * masked details suitable for display in the renderer.
 */
export async function getModelConfigStatus(
  profile?: string,
): Promise<ModelConfigResult> {
  try {
    const license = readLicense();
    const mc = getModelConfig(profile);
    const commercialSource = getConfigValue(
      "commercial_model_config_source",
      profile,
    );
    const hasCommercial = commercialSource === "license";
    const hasManual =
      !hasCommercial &&
      (mc.provider !== "auto" || mc.model !== "" || mc.baseUrl !== "");

    if (hasCommercial) {
      const baseUrl = mc.baseUrl || undefined;
      return {
        ok: true,
        status: {
          configured: true,
          base_url: baseUrl,
          api_key_masked: license
            ? maskSecret(license.license_key)
            : "[REDACTED]",
          source: "license",
        },
      };
    }

    if (hasManual) {
      return {
        ok: true,
        status: {
          configured: true,
          base_url: mc.baseUrl || undefined,
          api_key_masked: "[REDACTED]",
          source: "manual",
        },
      };
    }

    return {
      ok: true,
      status: {
        configured: false,
        source: "unknown",
        message: "No model config applied.",
      },
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to read model config status: ${(err as Error).message}`,
    };
  }
}

/**
 * Apply the license-based model configuration.
 *
 * Reads the saved license, constructs the model proxy config, and writes
 * it to the Hermes config files (config.yaml + .env).  The API key from
 * the license is written as HERMES_API_KEY in the .env so the gateway
 * can read it.
 *
 * Returns a controlled result — never throws or exposes raw secrets
 * to the renderer.
 */
export async function applyLicenseModelConfig(
  profile?: string,
): Promise<ModelConfigResult> {
  try {
    const license = readLicense();

    if (!validLicenseConfig(license)) {
      return {
        ok: false,
        status: {
          configured: false,
          source: "unknown",
          message: "No valid license found. Please save a license first.",
        },
        message: "No valid license found. Please save a license first.",
      };
    }

    const baseUrl = buildBaseUrl(license.vps_base_url);

    // Write base_url, provider to config.yaml
    // Use "custom" as provider so Hermes knows to use the base_url directly
    setModelConfig("custom", "", baseUrl, profile);

    // Set a marker so we know this was applied from a license
    setConfigValue("commercial_model_config_source", "license", profile);

    // Write the license key as the HERMES_API_KEY so the gateway uses it
    setEnvValue("HERMES_API_KEY", license.license_key, profile);

    return {
      ok: true,
      status: {
        configured: true,
        base_url: baseUrl,
        api_key_masked: maskSecret(license.license_key),
        source: "license",
      },
      message: "Model config applied successfully.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to apply model config: ${(err as Error).message}`,
    };
  }
}

/**
 * Reset (clear) the license-based model configuration.
 *
 * Removes the commercial model config fields without touching the user's
 * other config.  Only modifies fields that this module set.
 */
export async function resetLicenseModelConfig(
  profile?: string,
): Promise<ModelConfigResult> {
  try {
    // Clear the commercial source marker
    setConfigValue("commercial_model_config_source", "", profile);

    // Reset model config to defaults
    setModelConfig("auto", "", "", profile);

    return {
      ok: true,
      status: {
        configured: false,
        source: "unknown",
        message: "Model config reset.",
      },
      message: "Model config reset successfully.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to reset model config: ${(err as Error).message}`,
    };
  }
}
