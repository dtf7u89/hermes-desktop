import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";

const DEFAULT_VPS_BASE_URL = "https://apitokenhub.dpdns.org";

interface LicenseConfig {
  license_key: string;
  vps_base_url: string;
  device_id: string;
  created_at: string;
  updated_at: string;
  status: string;
}

interface ModelConfigStatus {
  configured: boolean;
  base_url?: string;
  api_key_masked?: string;
  source?: "license" | "manual" | "unknown";
  message?: string;
}

interface ModelConfigResult {
  ok: boolean;
  status?: ModelConfigStatus;
  message?: string;
}

function License(): React.JSX.Element {
  const { t } = useI18n();

  const [config, setConfig] = useState<LicenseConfig | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [vpsUrl, setVpsUrl] = useState(DEFAULT_VPS_BASE_URL);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status?: string;
    message?: string;
  } | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Model config state
  const [mcStatus, setMcStatus] = useState<ModelConfigResult | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcResult, setMcResult] = useState<string | null>(null);

  // Model proxy test state
  const [mpTestResult, setMpTestResult] = useState<{
    ok: boolean;
    status?: string;
    message?: string;
    model?: string;
    response_preview?: string;
  } | null>(null);
  const [mpTesting, setMpTesting] = useState(false);
  const [mpTestModel, setMpTestModel] = useState("gpt-5.5-fast");
  const [mpAutoSelectModel, setMpAutoSelectModel] = useState(true);

  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      const data = await window.hermesAPI.getLicense();
      if (data) {
        setConfig(data);
        setLicenseKey(data.license_key);
        setVpsUrl(data.vps_base_url);
      } else {
        setConfig(null);
        setLicenseKey("");
        setVpsUrl(DEFAULT_VPS_BASE_URL);
      }
    } catch (err) {
      console.error("[License] Failed to load config:", err);
      setConfig(null);
    }
  }, []);

  const loadMcStatus = useCallback(async (): Promise<void> => {
    try {
      const result = await window.hermesAPI.getModelConfigStatus();
      setMcStatus(result);
    } catch (err) {
      console.error("[License] Failed to load model config status:", err);
      setMcStatus(null);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadMcStatus();
  }, [loadConfig, loadMcStatus]);

  async function handleSave(): Promise<void> {
    setSaveResult(null);
    setTestResult(null);

    if (!licenseKey.trim()) {
      setSaveResult(t("license.errorEmptyKey"));
      return;
    }
    if (!vpsUrl.trim()) {
      setSaveResult(t("license.errorEmptyUrl"));
      return;
    }
    if (!vpsUrl.trim().startsWith("http://") && !vpsUrl.trim().startsWith("https://")) {
      setSaveResult(t("license.errorInvalidUrl"));
      return;
    }

    setSaving(true);
    try {
      const result = await window.hermesAPI.saveLicense({
        license_key: licenseKey.trim(),
        vps_base_url: vpsUrl.trim(),
      });
      setConfig(result);
      setLicenseKey(result.license_key);
      setVpsUrl(result.vps_base_url);
      setSaveResult(t("common.saved"));
      setTimeout(() => setSaveResult(null), 2000);
    } catch (err) {
      setSaveResult((err as Error).message || t("license.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(): Promise<void> {
    setTestResult(null);
    setTesting(true);
    try {
      const result = await window.hermesAPI.testLicense();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: (err as Error).message || t("license.testFailed"),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleClear(): Promise<void> {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    setClearConfirm(false);
    try {
      await window.hermesAPI.clearLicense();
      setConfig(null);
      setLicenseKey("");
      setVpsUrl(DEFAULT_VPS_BASE_URL);
      setTestResult(null);
      setSaveResult(t("license.cleared"));
      setTimeout(() => setSaveResult(null), 2000);
    } catch (err) {
      setSaveResult((err as Error).message || t("license.clearFailed"));
    }
  }

  async function handleApplyMc(): Promise<void> {
    setMcResult(null);
    setMcLoading(true);
    try {
      const result = await window.hermesAPI.applyLicenseModelConfig();
      if (result.ok) {
        setMcResult(t("modelConfig.applySuccess"));
      } else {
        setMcResult(result.message || t("modelConfig.failed"));
      }
      await loadMcStatus();
    } catch (err) {
      setMcResult((err as Error).message || t("modelConfig.failed"));
    } finally {
      setMcLoading(false);
    }
  }

  async function handleResetMc(): Promise<void> {
    setMcResult(null);
    setMcLoading(true);
    try {
      const result = await window.hermesAPI.resetLicenseModelConfig();
      if (result.ok) {
        setMcResult(t("modelConfig.resetSuccess"));
      } else {
        setMcResult(result.message || t("modelConfig.failed"));
      }
      await loadMcStatus();
    } catch (err) {
      setMcResult((err as Error).message || t("modelConfig.failed"));
    } finally {
      setMcLoading(false);
    }
  }

  async function handleRefreshMc(): Promise<void> {
    setMcResult(null);
    await loadMcStatus();
  }

  async function handleTestModelProxy(): Promise<void> {
    setMpTestResult(null);
    setMpTesting(true);
    try {
      const result = await window.hermesAPI.testModelProxy({
        model: mpTestModel.trim(),
        autoSelectModel: mpAutoSelectModel,
      });
      setMpTestResult(result);
    } catch (err) {
      setMpTestResult({
        ok: false,
        status: "error",
        message: (err as Error).message || t("modelProxy.failed"),
      });
    } finally {
      setMpTesting(false);
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  function sourceLabel(source?: string): string {
    switch (source) {
      case "license": return t("modelConfig.sourceLicense");
      case "manual": return t("modelConfig.sourceManual");
      default: return t("modelConfig.sourceUnknown");
    }
  }

  const statusLabel = config
    ? t(`license.status.${config.status}`) || config.status
    : t("license.status.notConfigured");

  return (
    <div className="settings-container">
      <h1 className="settings-header">{t("license.title")}</h1>

      {/* License form */}
      <div className="settings-section">
        <div className="settings-section-title">{t("license.configuration")}</div>

        <div className="settings-field">
          <label className="settings-field-label">
            {t("license.vpsUrl")}
          </label>
          <input
            className="input"
            type="text"
            value={vpsUrl}
            onChange={(e) => setVpsUrl(e.target.value)}
            placeholder={DEFAULT_VPS_BASE_URL}
          />
          <div className="settings-field-hint">{t("license.vpsUrlHint")}</div>
        </div>

        <div className="settings-field">
          <label className="settings-field-label">
            {t("license.licenseKey")}
          </label>
          <div className="settings-input-row">
            <input
              className="input"
              type={showKey ? "text" : "password"}
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="sk-user-xxxx"
            />
            <button
              className="btn-ghost settings-toggle-btn"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? t("common.hide") : t("common.show")}
            </button>
          </div>
          <div className="settings-field-hint">{t("license.licenseKeyHint")}</div>
        </div>

        {config && (
          <div className="settings-field">
            <label className="settings-field-label">
              {t("license.deviceId")}
            </label>
            <input
              className="input"
              type="text"
              value={config.device_id}
              readOnly
            />
            <div className="settings-field-hint">{t("license.deviceIdHint")}</div>
          </div>
        )}

        <div className="settings-field" style={{ marginTop: 4 }}>
          <label className="settings-field-label">
            {t("license.currentStatus")}
          </label>
          <span className={`settings-gateway-status ${config?.status === "active" ? "running" : "stopped"}`}>
            {statusLabel}
          </span>
          {config && (
            <div className="settings-field-hint">
              {t("license.createdAt")}: {formatDate(config.created_at)}
              {" · "}
              {t("license.updatedAt")}: {formatDate(config.updated_at)}
            </div>
          )}
        </div>

        {saveResult && (
          <div className="settings-field-hint" style={{ color: saveResult === t("common.saved") || saveResult === t("license.cleared") ? "var(--color-success)" : "var(--color-error)", marginTop: 4 }}>
            {saveResult}
          </div>
        )}
      </div>

      {/* Test connection result */}
      {testResult && (
        <div className="settings-section">
          <div className="settings-section-title">{t("license.testResult")}</div>
          <div className="settings-field">
            <span className={`settings-gateway-status ${testResult.ok ? "running" : "stopped"}`}>
              {testResult.ok ? t("license.testOk") : t("license.testFail")}
            </span>
            {testResult.message && (
              <div className="settings-field-hint">{testResult.message}</div>
            )}
            {testResult.status && (
              <div className="settings-field-hint">
                {t("license.remoteStatus")}: {testResult.status}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="settings-section">
        <div className="settings-gateway-row" style={{ gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("common.loadingShort") : t("common.save")}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? t("common.loadingShort") : t("license.testConnection")}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClear}
            disabled={!config}
            style={clearConfirm ? { color: "var(--color-error)" } : undefined}
          >
            {clearConfirm ? t("common.confirm") : t("license.clear")}
          </button>
        </div>
      </div>

      {/* Model Config Section */}
      <div className="settings-section">
        <div className="settings-section-title">{t("modelConfig.title")}</div>
        <div className="settings-field-hint" style={{ marginBottom: 8 }}>
          {t("modelConfig.description")}
        </div>

        {!config && (
          <div className="settings-field-hint" style={{ color: "var(--color-warning)" }}>
            {t("modelConfig.missingLicense")}
          </div>
        )}

        {mcStatus?.status && (
          <div className="settings-field">
            <label className="settings-field-label">{t("modelConfig.status")}</label>
            <span className={`settings-gateway-status ${mcStatus.status.configured ? "running" : "stopped"}`}>
              {mcStatus.status.configured ? t("modelConfig.configured") : t("modelConfig.notConfigured")}
            </span>
            {mcStatus.status.base_url && (
              <div className="settings-field-hint">
                {t("modelConfig.baseUrl")}: {mcStatus.status.base_url}
              </div>
            )}
            {mcStatus.status.api_key_masked && (
              <div className="settings-field-hint">
                {t("modelConfig.apiKey")}: {mcStatus.status.api_key_masked}
              </div>
            )}
            {mcStatus.status.source && (
              <div className="settings-field-hint">
                {t("modelConfig.source")}: {sourceLabel(mcStatus.status.source)}
              </div>
            )}
          </div>
        )}

        {mcResult && (
          <div className="settings-field-hint" style={{ color: "var(--color-success)", marginTop: 4 }}>
            {mcResult}
          </div>
        )}

        <div className="settings-gateway-row" style={{ gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleApplyMc}
            disabled={mcLoading || !config}
          >
            {mcLoading ? t("common.loadingShort") : t("modelConfig.apply")}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleResetMc}
            disabled={mcLoading}
          >
            {t("modelConfig.reset")}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRefreshMc}
            disabled={mcLoading}
          >
            {t("modelConfig.refresh")}
          </button>
        </div>
      </div>

      {/* Model Proxy Test */}
      <div className="settings-section">
        <div className="settings-section-title">{t("modelProxy.title")}</div>
        <div className="settings-field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
          {t("modelProxy.description")}
        </div>

        <div className="settings-field">
          <label className="settings-field-label">{t("modelProxy.testModel")}</label>
          <input
            className="input"
            type="text"
            value={mpTestModel}
            onChange={(e) => setMpTestModel(e.target.value)}
            placeholder="gpt-5.5-fast"
          />
          <div className="settings-field-hint">{t("modelProxy.testModelHint")}</div>
        </div>

        <label className="settings-field-hint" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={mpAutoSelectModel}
            onChange={(e) => setMpAutoSelectModel(e.target.checked)}
          />
          {t("modelProxy.autoSelectModel")}
        </label>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleTestModelProxy}
          disabled={mpTesting || !config}
          style={{ marginBottom: 12 }}
        >
          {mpTesting ? t("modelProxy.testing") : t("modelProxy.testButton")}
        </button>

        {!config && (
          <div className="settings-field-hint" style={{ color: "var(--color-warning)" }}>
            {t("modelProxy.saveLicenseFirst")}
          </div>
        )}

        {mpTestResult && (
          <div className="settings-field" style={{ marginTop: 8 }}>
            <span className={`settings-gateway-status ${mpTestResult.ok ? "running" : "stopped"}`}>
              {mpTestResult.ok ? t("modelProxy.testSuccess") : t("modelProxy.testFailed")}
            </span>
            {mpTestResult.status && (
              <div className="settings-field-hint" style={{ marginTop: 4 }}>
                {t("modelProxy.status")}: {mpTestResult.status}
              </div>
            )}
            {mpTestResult.model && (
              <div className="settings-field-hint">
                {t("modelProxy.model")}: {mpTestResult.model}
              </div>
            )}
            {mpTestResult.response_preview && (
              <div className="settings-field-hint" style={{ color: "var(--color-success)" }}>
                {t("modelProxy.response")}: {mpTestResult.response_preview}
              </div>
            )}
            {mpTestResult.message && !mpTestResult.ok && (
              <div className="settings-field-hint" style={{ color: "var(--color-error)", marginTop: 4 }}>
                {mpTestResult.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default License;
