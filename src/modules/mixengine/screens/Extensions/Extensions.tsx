import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import Button from "../../../../components/Button";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { ExtensionOffer } from "../../api/types/ExtensionOffer";
import type { ExtensionOrigin } from "../../api/types/ExtensionOrigin";
import type { ExtensionSummary } from "../../api/types/ExtensionSummary";
import StaleBadge from "../../components/StaleBadge";
import PlanDialog from "./PlanDialog";
import styles from "./Extensions.module.css";

/**
 * Registry, đã cài, cài (registry hoặc thư mục cục bộ), gỡ, bật/tắt một extension `kind: "service"`.
 *
 * Không có màn hình "cấu hình" — `extension.configure` không tồn tại (Quyết định D1, spec).
 */
export default function Extensions() {
  const [installed, setInstalled] = useState<ExtensionSummary[]>([]);
  const [available, setAvailable] = useState<ExtensionOffer[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [stale, setStale] = useState(false);
  const [serviceState, setServiceState] = useState<Record<string, string | null | undefined>>({});
  const [error, setError] = useState("");
  const [installingSource, setInstallingSource] = useState<ExtensionOrigin | null>(null);
  const [uninstalling, setUninstalling] = useState<ExtensionSummary | null>(null);
  const [deleteData, setDeleteData] = useState(false);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      const [inst, avail, services] = await Promise.all([
        api.extensionsInstalled(),
        api.extensionsAvailable(),
        api.services(),
      ]);
      setInstalled(inst.extensions);
      setAvailable(avail.extensions);
      setUnreadable(avail.unreadable);
      setStale(avail.stale);
      const states: Record<string, string | null | undefined> = {};
      for (const svc of services.services) states[svc.id] = svc.state;
      setServiceState(states);
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function browseInstallFromPath() {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string") setInstallingSource({ type: "path", path: picked });
  }

  /** `extension.*`, không phải `service.*` — xem Global Constraints của plan này. */
  async function toggle(row: ExtensionSummary, action: "start" | "stop") {
    setError("");
    try {
      if (action === "start") await api.extensionStart(row.id);
      else await api.extensionStop(row.id);
      void reload();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  async function confirmUninstall() {
    if (!uninstalling) return;
    setError("");
    try {
      await api.extensionUninstall({ id: uninstalling.id, delete_data: deleteData });
      setUninstalling(null);
      setDeleteData(false);
      void reload();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  return (
    <div className={styles.extensions}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <div className={styles.toolbar}>
        <Button onClick={() => void browseInstallFromPath()}>
          {t("mixengine.extensions.installFromPath")}
        </Button>
      </div>

      <h4>{t("mixengine.extensions.installedTitle")}</h4>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("mixengine.extensions.columnName")}</th>
            <th>{t("mixengine.extensions.columnVersion")}</th>
            <th>{t("mixengine.extensions.columnKind")}</th>
            <th>{t("mixengine.extensions.columnState")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {installed.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.version}</td>
              <td>{row.kind}</td>
              <td>{row.kind === "service" ? (serviceState[row.id] ?? "—") : "—"}</td>
              <td className={styles.rowActions}>
                {row.kind === "service" && (
                  <>
                    <Button onClick={() => void toggle(row, "start")}>
                      {t("mixengine.extensions.start")}
                    </Button>
                    <Button onClick={() => void toggle(row, "stop")}>
                      {t("mixengine.extensions.stop")}
                    </Button>
                  </>
                )}
                <Button onClick={() => setUninstalling(row)}>
                  {t("mixengine.extensions.uninstall")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {installed.length === 0 && (
        <p className={styles.empty}>{t("mixengine.extensions.emptyInstalled")}</p>
      )}

      <h4>
        {t("mixengine.extensions.registryTitle")} <StaleBadge stale={stale} />
      </h4>
      {unreadable > 0 && (
        <p className={styles.hint}>{t("mixengine.extensions.unreadable", { count: unreadable })}</p>
      )}
      <table className={styles.table}>
        <tbody>
          {available.map((offer) => (
            <tr key={offer.id}>
              <td>{offer.name}</td>
              <td>{offer.version}</td>
              <td>{offer.kind}</td>
              <td className={styles.rowActions}>
                {offer.installed ? (
                  <span className={styles.installedBadge}>{t("mixengine.extensions.installed")}</span>
                ) : (
                  <Button onClick={() => setInstallingSource({ type: "registry", id: offer.id })}>
                    {t("mixengine.extensions.install")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {installingSource && (
        <PlanDialog
          source={installingSource}
          onCancel={() => setInstallingSource(null)}
          onInstalled={() => {
            setInstallingSource(null);
            void reload();
          }}
        />
      )}

      {uninstalling && (
        <ConfirmDialog
          title={t("mixengine.extensions.uninstallTitle", { name: uninstalling.name })}
          message={t("mixengine.extensions.uninstallMessage")}
          danger
          onCancel={() => {
            setUninstalling(null);
            setDeleteData(false);
          }}
          onConfirm={() => void confirmUninstall()}
        >
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={deleteData}
              onChange={(e) => setDeleteData(e.target.checked)}
            />
            {t("mixengine.extensions.deleteData")}
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
