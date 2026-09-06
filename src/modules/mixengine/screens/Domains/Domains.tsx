import { useCallback, useEffect, useState } from "react";

import Button from "../../../../components/Button";
import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { DomainStatus } from "../../api/types/DomainStatus";
import AddDomainDialog from "./AddDomainDialog";
import CaBlock from "./CaBlock";
import styles from "./Domains.module.css";

/**
 * Bảng chẩn đoán domain — T2.5.
 *
 * **Bốn sự thật độc lập, không một verdict.** `hosts_entry`, `wildcard`, `server_answers`,
 * `resolves_to` mỗi cái trả lời một câu hỏi khác nhau; `because` là câu duy nhất nói cái gì sai,
 * vẽ nguyên văn — không dịch, vì đó là câu daemon tự viết.
 */
export default function Domains() {
  const [rows, setRows] = useState<DomainStatus[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      const report = await api.domains();
      setRows(report.domains);
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function remove(domain: string) {
    try {
      await api.domainRemove(domain);
      await reload();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  return (
    <div className={styles.domains}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <CaBlock onError={setError} />

      <div className={styles.toolbar}>
        <Button variant="primary" onClick={() => setAdding(true)}>
          {t("mixengine.domains.addDomain")}
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("mixengine.domains.columnDomain")}</th>
              <th>{t("mixengine.domains.columnSite")}</th>
              <th>{t("mixengine.domains.columnHosts")}</th>
              <th>{t("mixengine.domains.columnWildcard")}</th>
              <th>{t("mixengine.domains.columnServer")}</th>
              <th>{t("mixengine.domains.columnResolves")}</th>
              <th>{t("mixengine.domains.columnReason")}</th>
              <th>{t("mixengine.domains.columnActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.domain}>
                <td>{row.domain}</td>
                <td>{row.site ?? "—"}</td>
                <td>{row.hosts_entry ? "✓" : "—"}</td>
                <td>{row.wildcard ? "✓" : "—"}</td>
                <td>{row.server_answers ?? "—"}</td>
                <td>{row.resolves_to.length > 0 ? row.resolves_to.join(", ") : "—"}</td>
                <td>{row.because ?? ""}</td>
                <td>
                  <Button onClick={() => void remove(row.domain)}>
                    {t("mixengine.domains.remove")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className={styles.empty}>{t("mixengine.domains.empty")}</p>}

      {adding && (
        <AddDomainDialog
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
