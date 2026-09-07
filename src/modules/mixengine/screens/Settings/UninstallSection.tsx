import { useCallback, useEffect, useRef, useState } from "react";

import Button from "../../../../components/Button";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { JobSummary } from "../../api/types/JobSummary";
import type { Residue } from "../../api/types/Residue";
import type { UninstallReport } from "../../api/types/UninstallReport";
import styles from "./Settings.module.css";

/**
 * `daemon.uninstall_plan` trước và luôn luôn, rồi `daemon.uninstall` — T87.
 *
 * **Đổi `keep_home` gọi lại plan**, không tự suy luận dòng nào đổi: `uninstall_plan` là một đọc
 * thuần, daemon là nơi duy nhất biết đường dẫn nào bị ảnh hưởng bởi cờ đó.
 *
 * **Xác nhận hai lượt bấm thay vì một dialog riêng** — đủ để không xoá nhầm bằng một cú click lạc,
 * và đúng mức cho một hành động `uninstall_plan` đã cho xem trước toàn bộ.
 *
 * **Sau khi job xong, chờ `presence` rời khỏi `"running"` mới báo hoàn tất** — `JobSummary.state`
 * chuyển `"succeeded"` là lúc job *ghi xong kết quả*, không phải lúc daemon đã thoát; tin riêng
 * `state` là tin vào thời điểm sai (đúng luật "daemon chết là một trạng thái đọc được" đã theo từ
 * Pha 1). Việc này chỉ đo được với MixEngine thật — chưa kiểm được trong môi trường này.
 */
export default function UninstallSection({ onError }: { onError: (message: string) => void }) {
  const [keepHome, setKeepHome] = useState(false);
  const [plan, setPlan] = useState<UninstallReport | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [done, setDone] = useState(false);
  const { t } = useTranslation();
  const live = useRef(true);
  useEffect(() => () => {
    live.current = false;
  }, []);

  const reloadPlan = useCallback(async () => {
    try {
      setPlan(await api.uninstallPlan({ keep_home: keepHome, grant: false }));
    } catch (e) {
      onError(errorMessage(t, e));
    }
  }, [keepHome, t, onError]);

  useEffect(() => {
    void reloadPlan();
  }, [reloadPlan]);

  async function pollJob(id: number) {
    const summary = await api.jobStatus(id);
    if (!live.current) return;
    setJob(summary);
    if (summary.state === "running") {
      setTimeout(() => void pollJob(id), 1000);
      return;
    }
    // Job đã ghi kết quả. Chờ thêm daemon thật sự rời khỏi "running" trước khi nói "xong" — nếu
    // nó không bao giờ rời (vd. `keep_home: true` và daemon không cần thoát), dừng lại sau vài lần
    // thử thay vì chờ vô hạn.
    for (let i = 0; i < 10 && live.current; i++) {
      const presence = await api.presence();
      if (presence !== "running") break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (live.current) setDone(true);
  }

  async function confirm() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      const summary = await api.uninstall({ keep_home: keepHome, grant: true });
      setJob(summary);
      void pollJob(summary.id);
    } catch (e) {
      onError(errorMessage(t, e));
      setConfirming(false);
    }
  }

  function residueRow(item: Residue) {
    const { outcome } = item;
    // Câu thật của daemon khi có (`how`/`what`/`because`), tên biến thể khi outcome không mang câu
    // nào (`absent`, `removed` không kèm `what` trong bản build này) — không bao giờ để trống.
    const detail =
      "how" in outcome
        ? outcome.how
        : "what" in outcome
          ? outcome.what
          : "because" in outcome
            ? outcome.because
            : outcome.removal;
    return (
      <li key={item.id} className={styles.listItem}>
        <span>{item.what}</span>
        <span className={styles.muted}>{detail}</span>
      </li>
    );
  }

  if (done) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t("mixengine.settings.uninstall.title")}</h3>
        <p>{t("mixengine.settings.uninstall.done")}</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{t("mixengine.settings.uninstall.title")}</h3>

      <label className={styles.row}>
        <input
          type="checkbox"
          checked={keepHome}
          disabled={job !== null}
          onChange={(e) => setKeepHome(e.target.checked)}
        />
        {t("mixengine.settings.uninstall.keepHome")}
      </label>

      {plan && <ul className={styles.list}>{plan.items.map(residueRow)}</ul>}

      {job !== null ? (
        <p className={styles.muted}>
          {t("mixengine.settings.uninstall.running", { message: job.message })}
        </p>
      ) : (
        <Button className={styles.danger} onClick={() => void confirm()}>
          {confirming
            ? t("mixengine.settings.uninstall.confirmAgain")
            : t("mixengine.settings.uninstall.start")}
        </Button>
      )}
    </section>
  );
}
