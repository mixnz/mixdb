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

/* Bảng tra tường minh chứ không ghép `${action}ing`: "stop" + "ing" ra "stoping", và một khoá dịch
   dựng bằng phép nối chuỗi là một khoá không ai grep ra được. */
const PENDING_LABEL = {
  start: "mixengine.dashboard.starting",
  stop: "mixengine.dashboard.stopping",
  restart: "mixengine.dashboard.restarting",
} as const;

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
  /** Có bao nhiêu thao tác chờ quyền, theo `daemon.status`. Chỉ là con số; danh sách ở `elevation.status`. */
  const [waiting, setWaiting] = useState(0);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState("");
  /** Service nào đang có một hành động bay, và là hành động nào. Khoá theo id. */
  const [busy, setBusy] = useState<Record<string, api.ServiceAction>>({});
  const { t } = useTranslation();

  /* Mọi lỗi đi qua đây thành một câu người đọc được. `errorMessage` dịch `code` và điền `params`,
     nên `hint` của MixEngine tới người dùng nguyên vẹn thay vì rơi vào một promise không ai bắt —
     một tab đứng im, rỗng, không nói gì là kết cục tệ hơn bất kỳ thông báo nào. */
  const reload = useCallback(async () => {
    try {
      const [next, list] = await Promise.all([api.status(), api.services()]);
      setStatus(next);
      setRows(rowsFrom(list.services));
      setWaiting(next.elevation?.pending ?? 0);
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  /**
   * Mở danh sách thao tác đang chờ quyền quản trị.
   *
   * Một tab mở ra khi hàng đợi đã có sẵn thứ gì đó **không** nhận `elevation_required` — sự kiện đó
   * chỉ bắn lúc hàng đợi đổi. Nên con số ở `daemon.status` là thứ duy nhất nói rằng có gì đó đang
   * chờ, và `elevation.status` là chỗ lấy danh sách để hiện ra.
   */
  const showWaiting = useCallback(async () => {
    try {
      const answer = await api.elevationStatus();
      setPending(answer.pending);
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  /**
   * Một hành động trên một service.
   *
   * Hàng vẫn đổi theo stream trong lúc hành động đang chạy — đó là luật "trạng thái được thông
   * báo". Nhưng khi call trả về, đọc lại: **sự kiện là best-effort và không bao giờ là đường duy
   * nhất biết trạng thái**, nên tin mỗi stream là để lại một bảng đứng im khi một sự kiện rơi.
   * Đọc lại không phải là suy đoán, nó là đọc.
   */
  const act = useCallback(
    async (id: string, action: api.ServiceAction) => {
      setBusy((current) => ({ ...current, [id]: action }));
      try {
        await api.serviceAction(id, action);
      } catch (e) {
        setError(errorMessage(t, e));
      } finally {
        setBusy((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        await reload();
      }
    },
    [reload, t],
  );

  useEffect(() => {
    void reload();
    api.watch((raw) => {
      // Một lô rỗng nghĩa là không còn gì chờ — đóng hộp thoại thay vì để nó đứng đó rỗng không.
      // `elevation_required` mang cả số mới nhất: cập nhật `waiting` thẳng từ đây, không đợi một
      // `reload()` khác — nếu không, nút "N thao tác đang chờ" đứng yên với số cũ sau khi Cho phép,
      // vì bản thân sự kiện này chưa từng được xem là một lý do resync.
      const ops = pendingFrom(raw);
      if (ops !== null) {
        setPending(ops.length > 0 ? ops : null);
        setWaiting(ops.length);
      }
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
            onClick={() =>
              void Promise.all(
                rows.filter((row) => row.state === "running").map((row) => act(row.id, "stop")),
              )
            }
            disabled={
              rows.every((row) => row.state !== "running") || Object.keys(busy).length > 0
            }
          >
            {t("mixengine.dashboard.stopAll")}
          </button>
          {/* Không tự bật hộp thoại lúc mở tab: một lô có thể nằm chờ nhiều ngày, và một modal bật
              lên mỗi lần mở tab là thứ người ta học cách bấm bỏ mà không đọc. Một dòng bấm được
              nói đúng điều cần nói. */}
          {waiting > 0 && pending === null && (
            <button className={styles.waiting} onClick={() => void showWaiting()}>
              {t("mixengine.dashboard.elevationWaiting", { count: waiting })}
            </button>
          )}
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
                <td>
                  {busy[row.id] ? (
                    <span className={styles.pending}>
                      {t(PENDING_LABEL[busy[row.id]])}
                    </span>
                  ) : (
                    (row.state ?? "—")
                  )}
                </td>
                <td>{row.port ?? "—"}</td>
                <td className={styles.actions}>
                  <button
                    onClick={() => void act(row.id, "start")}
                    disabled={row.state === "running" || busy[row.id] !== undefined}
                  >
                    {t("mixengine.dashboard.start")}
                  </button>
                  <button
                    onClick={() => void act(row.id, "stop")}
                    disabled={row.state !== "running" || busy[row.id] !== undefined}
                  >
                    {t("mixengine.dashboard.stop")}
                  </button>
                  <button
                    onClick={() => void act(row.id, "restart")}
                    disabled={busy[row.id] !== undefined}
                  >
                    {t("mixengine.dashboard.restart")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className={styles.empty}>{t("mixengine.dashboard.noServices")}</p>}

      {pending && (
        <ElevationDialog
          pending={pending}
          onClose={() => {
            setPending(null);
            // Sau grant hoặc drop, hàng đợi đã khác: đọc lại con số thay vì giữ cái cũ.
            void reload();
          }}
        />
      )}
    </div>
  );
}
