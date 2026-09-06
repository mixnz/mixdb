import { useEffect, useState } from "react";

import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import { applyLogFrame, type LogEntry } from "../../logState";
import styles from "./Logs.module.css";

const MAX_ENTRIES = 2000;
const INITIAL_TAIL = 200;

type StreamFilter = "all" | "stdout" | "stderr";

export default function Logs() {
  const [ids, setIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tail, setTail] = useState(INITIAL_TAIL);
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    api
      .services()
      .then((list) => setIds(list.services.map((s) => s.id)))
      .catch((e: unknown) => setError(errorMessage(t, e)));
  }, [t]);

  useEffect(() => {
    if (selected === null) return;
    setEntries([]);
    api
      .logsWatch(selected, tail, true, (raw) => {
        setEntries((current) => applyLogFrame(current, raw, MAX_ENTRIES));
      })
      .catch((e: unknown) => setError(errorMessage(t, e)));
    return () => {
      void api.logsUnwatch();
    };
  }, [selected, tail, t]);

  const visible = entries.filter((entry) => {
    if (filter === "all") return true;
    if (entry.kind !== "line") return true; // gap/historic always shown — filter is stream-only
    return entry.stream === filter;
  });

  return (
    <div className={styles.screen}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}
      <div className={styles.list}>
        {ids.map((id) => (
          <button
            key={id}
            className={id === selected ? styles.activeRow : styles.row}
            onClick={() => {
              setSelected(id);
              setTail(INITIAL_TAIL);
            }}
          >
            {id}
          </button>
        ))}
        {ids.length === 0 && <p className={styles.empty}>{t("mixengine.logs.pickService")}</p>}
      </div>

      <div className={styles.viewer}>
        {selected === null ? (
          <p className={styles.empty}>{t("mixengine.logs.pickService")}</p>
        ) : (
          <>
            <div className={styles.toolbar}>
              <select value={filter} onChange={(e) => setFilter(e.target.value as StreamFilter)}>
                <option value="all">{t("mixengine.logs.streamAll")}</option>
                <option value="stdout">{t("mixengine.logs.streamStdout")}</option>
                <option value="stderr">{t("mixengine.logs.streamStderr")}</option>
              </select>
              <button onClick={() => setTail((current) => current * 2)}>
                {t("mixengine.logs.loadMore")}
              </button>
            </div>
            <div className={styles.lines}>
              {visible.length === 0 && <p className={styles.empty}>{t("mixengine.logs.empty")}</p>}
              {visible.map((entry, i) => {
                if (entry.kind === "gap") {
                  return (
                    <div key={i} className={styles.gap}>
                      {t("mixengine.logs.gap", { count: entry.missed })}
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={entry.kind === "line" && entry.stream === "stderr" ? styles.stderr : styles.line}
                  >
                    {entry.text}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
