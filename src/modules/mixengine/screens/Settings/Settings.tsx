import { useCallback, useEffect, useState } from "react";

import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { DaemonStatus } from "../../api/types/DaemonStatus";
import AutostartSection from "./AutostartSection";
import DiagnosticsSection from "./DiagnosticsSection";
import DoctorSection from "./DoctorSection";
import styles from "./Settings.module.css";
import UninstallSection from "./UninstallSection";
import UpdatesSection from "./UpdatesSection";

/**
 * Root directory, TLD quản lý, autostart, updates, doctor, gỡ MixEngine, diagnostics — T4.6–T4.8.
 *
 * **Root/TLD không gọi command mới nào** — cả hai đọc từ `daemon.status()`
 * (`home`, `dns?.wildcards`), cuộc gọi Dashboard đã làm mỗi lần `reload()`. Settings tự gọi lại một
 * lần riêng, rẻ hơn chia sẻ state với một màn khác.
 *
 * **"Default web server" chưa vẽ được** — `service.set_front_end`/`ServiceSummary.role` (T97) đã
 * merge vào `master` bên MixEngine nhưng chưa lên bản release ký nào; xem mục Nợ của spec. Hàng này
 * để trống có chú thích thay vì ẩn hẳn, cùng lý do Sidebar để cả mục Settings xám trước khi màn này
 * tồn tại.
 */
export default function Settings({ active }: { active: boolean }) {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      setStatus(await api.status());
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);

  return (
    <div className={styles.settings}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      {status && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("mixengine.settings.general.title")}</h3>
          <p className={styles.muted}>{t("mixengine.settings.general.root", { path: status.home })}</p>
          <p className={styles.muted}>
            {status.dns && status.dns.wildcards.length > 0
              ? t("mixengine.settings.general.tlds", { tlds: status.dns.wildcards.join(", ") })
              : t("mixengine.settings.general.noTlds")}
          </p>
          <p className={styles.muted} title={t("mixengine.settings.general.frontEndComingSoon")}>
            {t("mixengine.settings.general.frontEnd")}
          </p>
        </section>
      )}

      <AutostartSection onError={setError} />
      <UpdatesSection onError={setError} />
      <DoctorSection onError={setError} />
      <UninstallSection onError={setError} />
      <DiagnosticsSection onError={setError} />
    </div>
  );
}
