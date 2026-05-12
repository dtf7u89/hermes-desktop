import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../components/useI18n";

interface QuotaInfo {
  total_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  reset_at?: string | null;
  renew_url?: string | null;
  plan?: string | null;
  status?: string;
}

interface QuotaResult {
  ok: boolean;
  quota?: QuotaInfo;
  message?: string;
  status?: string;
}

function Billing(): React.JSX.Element {
  const { t } = useI18n();
  const [quotaResult, setQuotaResult] = useState<QuotaResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQuota = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await window.hermesAPI.getQuota();
      setQuotaResult(result);
    } catch (err) {
      setQuotaResult({
        ok: false,
        status: "error",
        message: (err as Error).message || t("billing.fetchFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const quota = quotaResult?.quota;
  const usagePercent = useMemo(() => {
    if (!quota || quota.total_tokens <= 0) return 0;
    return Math.min(100, Math.max(0, (quota.used_tokens / quota.total_tokens) * 100));
  }, [quota]);

  function formatTokens(value?: number): string {
    if (typeof value !== "number" || Number.isNaN(value)) return "—";
    return new Intl.NumberFormat().format(value);
  }

  function formatDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  async function openRenewUrl(): Promise<void> {
    if (quota?.renew_url) {
      await window.hermesAPI.openExternal(quota.renew_url);
    }
  }

  return (
    <div className="settings-container">
      <h1 className="settings-header">{t("billing.title")}</h1>

      <div className="settings-section">
        <div className="settings-section-title">{t("billing.overview")}</div>
        <div className="settings-field-hint">{t("billing.description")}</div>

        <div className="settings-gateway-row" style={{ gap: 8, marginTop: 12 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadQuota}
            disabled={loading}
          >
            {loading ? t("common.loadingShort") : t("common.refresh")}
          </button>
          {quota?.renew_url && (
            <button className="btn btn-secondary btn-sm" onClick={openRenewUrl}>
              {t("billing.renew")}
            </button>
          )}
        </div>
      </div>

      {quotaResult && !quotaResult.ok && (
        <div className="settings-section">
          <div className="settings-section-title">{t("billing.unavailable")}</div>
          <div className="settings-field">
            <span className="settings-gateway-status stopped">
              {quotaResult.status || "error"}
            </span>
            {quotaResult.message && (
              <div className="settings-field-hint">{quotaResult.message}</div>
            )}
          </div>
        </div>
      )}

      {quota && (
        <>
          <div className="settings-section">
            <div className="settings-section-title">{t("billing.tokenQuota")}</div>
            <div className="settings-field">
              <label className="settings-field-label">{t("billing.remaining")}</label>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {formatTokens(quota.remaining_tokens)}
              </div>
              <div className="settings-field-hint">
                {t("billing.usedOfTotal", {
                  used: formatTokens(quota.used_tokens),
                  total: formatTokens(quota.total_tokens),
                })}
              </div>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "var(--color-bg-tertiary)",
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              <div
                style={{
                  width: `${usagePercent}%`,
                  height: "100%",
                  background: "var(--color-accent)",
                }}
              />
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">{t("billing.details")}</div>
            <div className="settings-field">
              <label className="settings-field-label">{t("billing.plan")}</label>
              <div className="settings-field-hint">{quota.plan || "—"}</div>
            </div>
            <div className="settings-field">
              <label className="settings-field-label">{t("billing.status")}</label>
              <span className={`settings-gateway-status ${quota.status === "active" || quotaResult?.ok ? "running" : "stopped"}`}>
                {quota.status || quotaResult?.status || "ok"}
              </span>
            </div>
            <div className="settings-field">
              <label className="settings-field-label">{t("billing.resetAt")}</label>
              <div className="settings-field-hint">{formatDate(quota.reset_at)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Billing;
