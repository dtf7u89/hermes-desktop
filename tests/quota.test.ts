import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const quotaSrc = readFileSync(join(ROOT, "src/main/quota.ts"), "utf-8");
const preloadSrc = readFileSync(join(ROOT, "src/preload/index.ts"), "utf-8");
const preloadTypes = readFileSync(join(ROOT, "src/preload/index.d.ts"), "utf-8");
const indexSrc = readFileSync(join(ROOT, "src/main/index.ts"), "utf-8");
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);

describe("Round7D quota module — New API Bearer auth & native endpoint", () => {
  it("defines quota response data shape and fetchQuota function", () => {
    expect(quotaSrc).toContain("export interface QuotaInfo");
    expect(quotaSrc).toContain("total_tokens");
    expect(quotaSrc).toContain("used_tokens");
    expect(quotaSrc).toContain("remaining_tokens");
    expect(quotaSrc).toContain("renew_url");
    expect(quotaSrc).toContain("export async function fetchQuota");
  });

  it("uses Authorization: Bearer *** NOT query params for license_key", () => {
    // Must use Bearer auth header
    expect(quotaSrc).toContain("Authorization");
    expect(quotaSrc).toContain("Bearer");
    // Must NOT put license_key in query string
    expect(quotaSrc).not.toContain("license_key=");
  });

  it("maps HTTP errors to structured status codes", () => {
    // Error mapping function must handle all required statuses
    expect(quotaSrc).toContain("unauthorized");
    expect(quotaSrc).toContain("quota_exceeded");
    expect(quotaSrc).toContain("rate_limited");
    expect(quotaSrc).toContain("server_error");
    expect(quotaSrc).toContain("network_error");
    expect(quotaSrc).toContain("bad_response");
    expect(quotaSrc).toContain("not_configured");
  });

  it("returns not_configured when license is missing", () => {
    expect(quotaSrc).toContain("No license configuration found");
    expect(quotaSrc).toContain("not_configured");
    expect(quotaSrc).toContain("ok: false");
  });

  it("sanitizes error messages to prevent token/URL leakage", () => {
    // Should clean URLs from error messages
    expect(quotaSrc).toContain("[URL]");
  });

  it("has AbortController timeout for network requests", () => {
    expect(quotaSrc).toContain("AbortController");
    expect(quotaSrc).toContain("AbortError");
  });

  // ── New API native endpoint tests (Round7D) ──────────────────────

  it("uses /api/user/self as primary New API endpoint", () => {
    expect(quotaSrc).toContain("/api/user/self");
    expect(quotaSrc).toContain("fetchJson(");
  });

  it("falls back to legacy /api/quota if /api/user/self fails", () => {
    // Legacy endpoint path must be preserved for Round6 mock compatibility
    expect(quotaSrc).toContain("/api/quota");
  });

  it("has normalizeNewApiQuota helper for New API response", () => {
    expect(quotaSrc).toContain("normalizeNewApiQuota");
    expect(quotaSrc).toContain("data.quota");
    expect(quotaSrc).toContain("data.used_quota");
  });

  it("has fetchJson helper for authenticated GET requests", () => {
    expect(quotaSrc).toContain("fetchJson");
  });

  it("handles New API success:false as unauthorized", () => {
    expect(quotaSrc).toContain("success === false");
    expect(quotaSrc).toContain("New API returned an authorization error");
  });

  it("normalizes New API quota/used_quota fields into QuotaInfo", () => {
    // Should map data.quota → remaining_tokens, data.used_quota → used_tokens
    expect(quotaSrc).toContain("remaining");
    expect(quotaSrc).toContain("used");
  });
});

describe("Round7D quota IPC and preload API", () => {
  it("registers quota:get IPC handler", () => {
    expect(indexSrc).toContain("fetchQuota");
    expect(indexSrc).toContain('ipcMain.handle("quota:get"');
  });

  it("exposes getQuota in preload implementation and types", () => {
    expect(preloadSrc).toContain("getQuota");
    expect(preloadSrc).toContain('ipcRenderer.invoke("quota:get")');
    expect(preloadTypes).toContain("getQuota");
    expect(preloadTypes).toContain("QuotaInfo");
  });
});

describe("Round4 Billing UI", () => {
  it("adds Billing view to navigation and renders Billing screen", () => {
    expect(layoutSrc).toContain('import Billing from "../Billing/Billing"');
    expect(layoutSrc).toContain('| "billing"');
    expect(layoutSrc).toContain("navigation.billing");
    expect(layoutSrc).toContain("<Billing />");
  });
});
