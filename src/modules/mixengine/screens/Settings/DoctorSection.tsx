import { useCallback, useEffect, useState } from "react";

import Button from "../../../../components/Button";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { DoctorReport } from "../../api/types/DoctorReport";
import ElevationDialog from "../../components/ElevationDialog";
import { doctorChecksInOrder } from "../../settingsState";
import styles from "./Settings.module.css";

/**
 * `daemon.doctor` + `daemon.doctor_repair`.
 *
 * **Sửa dùng lại đúng hàng đợi `elevation.status`/`ElevationDialog` Dashboard đã dựng ở Pha 1**
 * (Quyết định D3, spec Metrics/Settings) — không viết dialog elevation thứ hai. Gọi
 * `doctorRepair({ grant: false })` xong, đọc `elevation.status`: có gì chờ thì mở đúng dialog đó;
 * không có gì (sửa nằm trong `MIXENGINE_HOME` không cần quyền) thì chỉ đọc lại report.
 */
export default function DoctorSection({ onError }: { onError: (message: string) => void }) {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [pending, setPending] = useState<unknown[] | null>(null);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      setReport(await api.doctor());
    } catch (e) {
      onError(errorMessage(t, e));
    }
  }, [t, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function repair() {
    setRepairing(true);
    try {
      await api.doctorRepair({ grant: false });
      const queue = await api.elevationStatus();
      if (queue.pending.length > 0) {
        setPending(queue.pending);
      } else {
        await reload();
      }
    } catch (e) {
      onError(errorMessage(t, e));
    } finally {
      setRepairing(false);
    }
  }

  if (report === null) return null;

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{t("mixengine.settings.doctor.title")}</h3>

      <ul className={styles.list}>
        {doctorChecksInOrder(report).map((check, index) => (
          // Vị trí là khoá: report không có id nào khác, và thứ tự cố định là chính điều đang test.
          <li key={index} className={styles.listItem}>
            <span>{check.name}</span>
            <span
              className={
                check.outcome.outcome === "ok"
                  ? styles.ok
                  : check.outcome.outcome === "problem"
                    ? styles.bad
                    : styles.muted
              }
            >
              {check.outcome.outcome === "ok"
                ? t("mixengine.settings.doctor.ok")
                : "because" in check.outcome
                  ? check.outcome.because
                  : ""}
            </span>
          </li>
        ))}
      </ul>

      <Button onClick={() => void repair()} disabled={repairing}>
        {t("mixengine.settings.doctor.repair")}
      </Button>

      {pending && (
        <ElevationDialog
          pending={pending}
          onClose={() => {
            setPending(null);
            void reload();
          }}
        />
      )}
    </section>
  );
}
