import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { DaemonStatus } from "../../api/types/DaemonStatus";
import type { ServiceSummary } from "../../api/types/ServiceSummary";
import styles from "./Dashboard.module.css";

/** Daemon, và mọi thứ nó đang giám sát. */
export default function Dashboard() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [rows, setRows] = useState<ServiceSummary[]>([]);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    const [next, list] = await Promise.all([api.status(), api.services()]);
    setStatus(next);
    setRows(list);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className={styles.dashboard}>
      {status && (
        <header className={styles.header}>
          <strong>MixEngine {status.version}</strong>
          <span className={styles.home}>{status.home}</span>
        </header>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("mixengine.dashboard.service")}</th>
              <th>{t("mixengine.dashboard.state")}</th>
              <th>{t("mixengine.dashboard.port")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.state ?? "—"}</td>
                <td>{row.port ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className={styles.empty}>{t("mixengine.dashboard.noServices")}</p>}
    </div>
  );
}
