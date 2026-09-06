import { useCallback, useEffect, useState } from "react";

import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { DaemonStatus } from "../../api/types/DaemonStatus";
import ElevationDialog from "../../components/ElevationDialog";
import {
  applyEvent,
  applyJob,
  needsResync,
  rowsFrom,
  type JobRow,
  type ServiceRow,
} from "../../daemonState";
import { pendingFrom } from "../../pendingOps";
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
  const [pending, setPending] = useState<unknown[] | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  /* Mọi lỗi đi qua đây thành một câu người đọc được. `errorMessage` dịch `code` và điền `params`,
     nên `hint` của MixEngine tới người dùng nguyên vẹn thay vì rơi vào một promise không ai bắt —
     một tab đứng im, rỗng, không nói gì là kết cục tệ hơn bất kỳ thông báo nào. */
  const reload = useCallback(async () => {
    try {
      const [next, list] = await Promise.all([api.status(), api.services()]);
      setStatus(next);
      setRows(rowsFrom(list.services));
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  /** Một hành động trên một service; hàng tự đổi khi stream nói, không phải ở đây. */
  const act = useCallback(
    async (id: string, action: api.ServiceAction) => {
      try {
        await api.serviceAction(id, action);
      } catch (e) {
        setError(errorMessage(t, e));
      }
    },
    [t],
  );

  useEffect(() => {
    void reload();
    api.watch((raw) => {
      // Một lô rỗng nghĩa là không còn gì chờ — đóng hộp thoại thay vì để nó đứng đó rỗng không.
      const ops = pendingFrom(raw);
      if (ops !== null) setPending(ops.length > 0 ? ops : null);
      setJobs((current) => applyJob(current, raw));
      // Sự kiện là best-effort: khi bus bên kia tràn hay kết nối đứt, đọc lại thay vì tin cái đang
      // có trên màn hình. Ngoài updater, vì updater chạy hai lần trong StrictMode.
      if (needsResync(raw)) void reload();
      setRows((current) => applyEvent(current, raw).rows);
    }).catch((e: unknown) => setError(errorMessage(t, e)));
    return () => {
      void api.unwatch();
    };
  }, [reload, t]);

  return (
    <div className={styles.dashboard}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      {status && (
        <header className={styles.header}>
          <strong>MixEngine {status.version}</strong>
          <span className={styles.home}>{status.home}</span>
          {/* Không đổi hàng nào ở đây: bảng đổi khi `service_state_changed` tới, không khi bấm. */}
          <button
            onClick={() => void Promise.all(rows.map((row) => act(row.id, "stop")))}
            disabled={rows.every((row) => row.state !== "running")}
          >
            {t("mixengine.dashboard.stopAll")}
          </button>
        </header>
      )}

      {jobs.length > 0 && (
        <ul className={styles.jobs}>
          {jobs.map((job) => (
            <li key={job.id}>
              <span>{job.kind || t("mixengine.dashboard.job")}</span>
              <progress value={job.percent} max={100} />
              <span>{job.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("mixengine.dashboard.service")}</th>
              <th>{t("mixengine.dashboard.state")}</th>
              <th>{t("mixengine.dashboard.port")}</th>
              <th>{t("mixengine.dashboard.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.state ?? "—"}</td>
                <td>{row.port ?? "—"}</td>
                <td className={styles.actions}>
                  <button
                    onClick={() => void act(row.id, "start")}
                    disabled={row.state === "running"}
                  >
                    {t("mixengine.dashboard.start")}
                  </button>
                  <button
                    onClick={() => void act(row.id, "stop")}
                    disabled={row.state !== "running"}
                  >
                    {t("mixengine.dashboard.stop")}
                  </button>
                  <button onClick={() => void act(row.id, "restart")}>
                    {t("mixengine.dashboard.restart")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className={styles.empty}>{t("mixengine.dashboard.noServices")}</p>}

      {pending && <ElevationDialog pending={pending} onClose={() => setPending(null)} />}
    </div>
  );
}
