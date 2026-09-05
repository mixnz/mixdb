import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { DaemonStatus } from "../../api/types/DaemonStatus";
import { applyEvent, rowsFrom, type ServiceRow } from "../../daemonState";
import styles from "./Dashboard.module.css";

/**
 * Daemon, và mọi thứ nó đang giám sát.
 *
 * **Trạng thái đến từ stream, không từ suy đoán.** Bấm Start thì hàng đó chuyển sang `starting` khi
 * `service_state_changed` nói vậy, không phải ngay lúc bấm — một công tắc nói dối về việc MariaDB
 * có đang chạy hay không tệ hơn một công tắc chậm.
 */
export default function Dashboard() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    const [next, list] = await Promise.all([api.status(), api.services()]);
    setStatus(next);
    setRows(rowsFrom(list));
  }, []);

  useEffect(() => {
    void reload();
    void api.watch((raw) => {
      setRows((current) => {
        const next = applyEvent(current, raw);
        // Sự kiện là best-effort: khi bus bên kia tràn hay kết nối đứt, đọc lại thay vì tin cái
        // đang có trên màn hình.
        if (next.resync) void reload();
        return next.rows;
      });
    });
    return () => {
      void api.unwatch();
    };
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
