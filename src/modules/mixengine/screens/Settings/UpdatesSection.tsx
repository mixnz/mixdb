import { useCallback, useEffect, useState } from "react";

import Button from "../../../../components/Button";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { UpdateStatus } from "../../api/types/UpdateStatus";
import styles from "./Settings.module.css";

/**
 * `update.status`/`check`/`decide`/`apply`.
 *
 * **`update.apply` kết thúc chính daemon đang phục vụ request đó** — cùng luật `daemon.shutdown`
 * Pha 1 đã theo (T1.5). `applying` ở lại `true` sau khi lời gọi thành công vì không có "xong" nào
 * để quay lại từ đây — tab MixEngine tự đọc lại trạng thái daemon (`presence`) khi ai đó tương tác
 * tiếp, đúng luật "daemon chết là một trạng thái đọc được".
 */
export default function UpdatesSection({ onError }: { onError: (message: string) => void }) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      setStatus(await api.updateStatus());
    } catch (e) {
      onError(errorMessage(t, e));
    }
  }, [t, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function check() {
    setChecking(true);
    try {
      setStatus(await api.updateCheck({ force: true }));
    } catch (e) {
      onError(errorMessage(t, e));
    } finally {
      setChecking(false);
    }
  }

  async function decide(decision: "skip" | "later") {
    if (status?.available == null) return;
    try {
      setStatus(await api.updateDecide({ version: status.available.version, decision }));
    } catch (e) {
      onError(errorMessage(t, e));
    }
  }

  async function apply() {
    if (status?.available == null) return;
    setApplying(true);
    try {
      await api.updateApply({ version: status.available.version });
      // Không setApplying(false) ở đây: daemon vừa tự thoát, và "đang cài đặt lại" là câu đúng
      // cho tới khi tab tự phát hiện daemon đã trở lại.
    } catch (e) {
      onError(errorMessage(t, e));
      setApplying(false);
    }
  }

  if (status === null) return null;

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{t("mixengine.settings.updates.title")}</h3>

      <p className={styles.muted}>
        {t("mixengine.settings.updates.current", { version: status.current })}
      </p>

      {applying ? (
        <p className={styles.muted}>{t("mixengine.settings.updates.applying")}</p>
      ) : status.offered && status.available ? (
        <div className={styles.row}>
          <span>{t("mixengine.settings.updates.offered", { version: status.available.version })}</span>
          <Button onClick={() => void apply()}>{t("mixengine.settings.updates.apply")}</Button>
          <Button onClick={() => void decide("later")}>{t("mixengine.settings.updates.later")}</Button>
          <Button onClick={() => void decide("skip")}>{t("mixengine.settings.updates.skip")}</Button>
        </div>
      ) : (
        <p className={styles.muted}>
          {status.available
            ? t("mixengine.settings.updates.notOffered", { because: status.because ?? "" })
            : t("mixengine.settings.updates.none")}
        </p>
      )}

      {status.placement.kind === "managed" && (
        <p className={styles.muted}>
          {t("mixengine.settings.updates.managed", { because: status.placement.because })}
        </p>
      )}

      <div className={styles.row}>
        <Button onClick={() => void check()} disabled={checking}>
          {checking ? t("mixengine.settings.updates.checking") : t("mixengine.settings.updates.check")}
        </Button>
        {/* Phản hồi cho lần bấm vừa rồi — không có dòng này, một lần kiểm tra không tìm thấy gì mới
            khiến màn hình đứng y nguyên và trông như cái nút không làm gì cả. */}
        <span className={styles.muted}>
          {status.checked_at === null || status.checked_at === undefined
            ? t("mixengine.settings.updates.neverChecked")
            : t("mixengine.settings.updates.checkedAt", {
                time: new Date(status.checked_at).toLocaleTimeString(),
              })}
          {status.stale && ` ${t("mixengine.settings.updates.stale")}`}
        </span>
      </div>
    </section>
  );
}
