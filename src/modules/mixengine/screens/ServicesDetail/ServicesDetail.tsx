import { useCallback, useEffect, useState } from "react";

import Button from "../../../../components/Button";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import DatabasePanel from "./DatabasePanel";
import IdlePanel from "./IdlePanel";
import LimitsPanel from "./LimitsPanel";
import styles from "./ServicesDetail.module.css";

export default function ServicesDetail() {
  const [ids, setIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [forceHint, setForceHint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      const list = await api.services();
      setIds(list.services.map((s) => s.id));
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function deleteService(id: string, force: boolean) {
    setError("");
    try {
      await api.serviceDelete({ service: id, force });
      setDeleteTarget(null);
      setForceHint(null);
      if (selected === id) setSelected(null);
      void reload();
    } catch (e) {
      // Cùng luật `runtime.uninstall` đã theo ở Languages.tsx: lần đầu chưa gửi `force`, refuse
      // nêu tên site nào đang khai — hỏi lại đúng câu daemon viết, không tự bịa.
      if (!force) {
        setForceHint(errorMessage(t, e));
      } else {
        setError(errorMessage(t, e));
      }
    }
  }

  return (
    <div className={styles.screen}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}
      <div className={styles.list}>
        {ids.map((id) => (
          <button
            key={id}
            className={id === selected ? styles.activeRow : styles.row}
            onClick={() => setSelected(id)}
          >
            {id}
          </button>
        ))}
        {ids.length === 0 && (
          <p className={styles.listEmpty}>{t("mixengine.servicesDetail.pickService")}</p>
        )}
      </div>
      <div className={styles.detail}>
        {selected === null ? (
          <p className={styles.empty}>{t("mixengine.servicesDetail.pickService")}</p>
        ) : (
          <>
            <div className={styles.header}>
              <h3 className={styles.headerTitle}>{selected}</h3>
              <Button onClick={() => setDeleteTarget(selected)}>
                {t("mixengine.servicesDetail.delete")}
              </Button>
            </div>
            <LimitsPanel service={selected} />
            <IdlePanel service={selected} />
            <DatabasePanel service={selected} />
          </>
        )}
      </div>

      {deleteTarget !== null && (
        <ConfirmDialog
          title={t("mixengine.servicesDetail.deleteTitle", { service: deleteTarget })}
          message={forceHint ?? t("mixengine.servicesDetail.deleteMessage")}
          confirmLabel={
            forceHint !== null ? t("mixengine.servicesDetail.deleteForceConfirm") : undefined
          }
          danger
          onCancel={() => {
            setDeleteTarget(null);
            setForceHint(null);
          }}
          onConfirm={() => void deleteService(deleteTarget, forceHint !== null)}
        />
      )}
    </div>
  );
}
