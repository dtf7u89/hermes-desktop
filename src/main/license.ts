import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import { getLicenseFilePath, ensurePortableDirs } from "./portable-paths";

/**
 * License configuration stored in data/license.json.
 * Uses only portable data paths — never ~/.hermes.
 */
export interface LicenseConfig {
  license_key: string;
  vps_base_url: string;
  device_id: string;
  created_at: string;
  updated_at: string;
  status: "unknown" | "active" | "invalid" | "error";
}

const LICENSE_FILE = getLicenseFilePath();

/**
 * Read the current license configuration.
 * Returns null if the file doesn't exist or JSON is corrupt.
 */
export function readLicense(): LicenseConfig | null {
  try {
    if (!existsSync(LICENSE_FILE)) return null;

    const raw = readFileSync(LICENSE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as LicenseConfig;

    // Validate required fields
    if (
      !parsed.license_key ||
      !parsed.vps_base_url ||
      !parsed.device_id
    ) {
      console.warn("[license] Corrupt license.json — missing required fields");
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[license] Failed to read license:", (err as Error).message);
    return null;
  }
}

/**
 * Save (or update) the license configuration.
 * Preserves existing device_id and created_at when updating.
 */
export function saveLicense(input: {
  license_key: string;
  vps_base_url: string;
}): LicenseConfig {
  ensurePortableDirs();

  const existing = readLicense();
  const now = new Date().toISOString();

  const config: LicenseConfig = {
    license_key: input.license_key.trim(),
    vps_base_url: normalizeVpsBaseUrl(input.vps_base_url),
    device_id: getOrCreateDeviceId(existing?.device_id),
    created_at: existing?.created_at || now,
    updated_at: now,
    status: "unknown",
  };

  writeFileSync(LICENSE_FILE, JSON.stringify(config, null, 2), "utf-8");
  console.log("[license] License saved to", LICENSE_FILE);
  return config;
}

/**
 * Clear (delete) the license file.
 */
export function clearLicense(): void {
  try {
    if (existsSync(LICENSE_FILE)) {
      unlinkSync(LICENSE_FILE);
      console.log("[license] License file removed:", LICENSE_FILE);
    }
  } catch (err) {
    console.error("[license] Failed to clear license:", (err as Error).message);
  }
}

/**
 * Generate a device ID or return the existing one.
 * Uses crypto.randomUUID() (Node 15+); falls back to timestamp-based ID.
 */
export function getOrCreateDeviceId(existing?: string): string {
  if (existing && existing.trim()) return existing.trim();

  try {
    return randomUUID();
  } catch {
    // Fallback for very old Node versions (shouldn't be needed in Electron)
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `${ts}-${rand}`;
  }
}

/**
 * Mask a license key for display: show first 3 and last 4 characters.
 * Example: "sk-user-demo-longkey" → "sk-***-nkey"
 */
export function maskLicenseKey(key: string): string {
  if (!key) return "(empty)";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 3)}***${key.slice(-4)}`;
}

/**
 * Normalize VPS base URL: trim whitespace, strip trailing slash.
 */
export function normalizeVpsBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Validate license input for IPC.
 * Returns null if valid, error message string if invalid.
 */
export function validateLicenseInput(input: {
  license_key: string;
  vps_base_url: string;
}): string | null {
  if (!input.license_key || !input.license_key.trim()) {
    return "License key cannot be empty";
  }
  if (!input.vps_base_url || !input.vps_base_url.trim()) {
    return "VPS base URL cannot be empty";
  }

  const url = input.vps_base_url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "VPS base URL must start with http:// or https://";
  }

  return null; // valid
}

/**
 * Test license connection against the VPS endpoint.
 *
 * Calls GET {vps_base_url}/api/license/status?license_key=...&device_id=...
 * If the VPS is unreachable or returns non-200, returns a descriptive error.
 * If no VPS is configured, returns a mock response — easy to replace later.
 */
export async function testLicenseConnection(): Promise<{
  ok: boolean;
  status?: string;
  message?: string;
}> {
  const config = readLicense();

  if (!config) {
    return {
      ok: false,
      status: "unknown",
      message: "No license configuration found. Please save a license first.",
    };
  }

  const url = `${config.vps_base_url}/api/license/status?license_key=${encodeURIComponent(config.license_key)}&device_id=${encodeURIComponent(config.device_id)}`;

  try {
    // Use Node's built-in fetch (available in Electron 28+ / Node 18+)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        status: "error",
        message: `VPS returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as Record<string, unknown>;
    return {
      ok: true,
      status: (body.status as string) || "unknown",
      message: (body.message as string) || undefined,
    };
  } catch (err) {
    // Network error, DNS failure, timeout, or fetch not available
    const msg = (err as Error).message;

    // If fetch is not available (older Electron), or network is unreachable,
    // return a controlled mock response so the UI doesn't crash.
    return {
      ok: false,
      status: "unknown",
      message: `VPS verification not available: ${msg}. License saved locally.`,
    };
  }
}
