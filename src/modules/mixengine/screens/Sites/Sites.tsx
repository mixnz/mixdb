import { useCallback, useEffect, useState } from "react";

import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import { applySharingChange, canEditSite, type SiteRow } from "../../siteState";
import styles from "./Sites.module.css";

/**
 * Mọi site trong home, và trạng thái chia sẻ LAN của chúng.
 *
 * **Chia sẻ đến từ stream, không từ suy đoán** — `site_sharing_changed` là chỗ roadmap gọi là "chỗ
 * duy nhất `mix` là client yếu hơn": với CLI lý do nằm trong log không ai đọc, ở đây nó phải là một
 * dòng thấy được ngay khi nó tới.
 */
export default function Sites() {
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      const list = await api.sites();
      setRows(list.sites);
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  useEffect(() => {
    void reload();
    api.watch((raw) => {
      setRows((current) => applySharingChange(current, raw));
    }).catch((e: unknown) => setError(errorMessage(t, e)));
    return () => {
      void api.unwatch();
    };
  }, [reload, t]);

  return (
    <div className={styles.sites}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("mixengine.sites.columnDomain")}</th>
              <th>{t("mixengine.sites.columnOwner")}</th>
              <th>{t("mixengine.sites.columnKind")}</th>
              <th>{t("mixengine.sites.columnHttps")}</th>
              <th>{t("mixengine.sites.columnState")}</th>
              <th>{t("mixengine.sites.columnSharing")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.domain}>
                <td>{row.domain}</td>
                <td>
                  {row.owner.type === "project"
                    ? t("mixengine.sites.ownerProject", { name: row.owner.name })
                    : t("mixengine.sites.ownerExtension", { id: row.owner.id })}
                  {!canEditSite(row.owner) && (
                    <span className={styles.readOnly} title={t("mixengine.sites.editDisabledHint")}>
                      {" "}
                      🔒
                    </span>
                  )}
                </td>
                <td>{row.kind.kind}</td>
                <td>{row.https ? "✓" : "—"}</td>
                <td>{row.state}</td>
                <td>
                  {row.sharing
                    ? row.sharing.until
                      ? t("mixengine.sites.sharingUntil", { until: row.sharing.until })
                      : t("mixengine.sites.sharingIndefinite")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className={styles.empty}>{t("mixengine.sites.empty")}</p>}
    </div>
  );
}
