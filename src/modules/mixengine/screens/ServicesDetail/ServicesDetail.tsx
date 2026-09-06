import { useEffect, useState } from "react";

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
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    api
      .services()
      .then((list) => setIds(list.services.map((s) => s.id)))
      .catch((e: unknown) => setError(errorMessage(t, e)));
  }, [t]);

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
        {ids.length === 0 && <p className={styles.empty}>{t("mixengine.servicesDetail.pickService")}</p>}
      </div>
      <div className={styles.detail}>
        {selected === null ? (
          <p className={styles.empty}>{t("mixengine.servicesDetail.pickService")}</p>
        ) : (
          <>
            <LimitsPanel service={selected} />
            <IdlePanel service={selected} />
            <DatabasePanel service={selected} />
          </>
        )}
      </div>
    </div>
  );
}
