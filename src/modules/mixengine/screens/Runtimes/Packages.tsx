import { useCallback, useEffect, useState } from "react";

import Button from "../../../../components/Button";
import ErrorBanner from "../../../../components/ErrorBanner";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { PackageRelease } from "../../api/types/PackageRelease";
import type { PackageSummary } from "../../api/types/PackageSummary";
import { applyJob, type JobRow } from "../../daemonState";
import { jobFor, versionKey } from "../../runtimeState";
import StaleBadge from "../../components/StaleBadge";
import styles from "./Packages.module.css";

export default function Packages() {
  const [installed, setInstalled] = useState<PackageSummary[]>([]);
  const [available, setAvailable] = useState<PackageRelease[]>([]);
  const [stale, setStale] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [installingJob, setInstallingJob] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      const [inst, avail] = await Promise.all([api.packagesInstalled(), api.packagesAvailable()]);
      setInstalled(inst.packages);
      setAvailable(avail.packages);
      setStale(avail.stale);
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [t]);

  useEffect(() => {
    void reload();
    api.watch((raw) => {
      setJobs((current) => applyJob(current, raw));
    }).catch((e: unknown) => setError(errorMessage(t, e)));
    return () => {
      void api.unwatch();
    };
  }, [reload, t]);

  async function install(release: PackageRelease) {
    setError("");
    try {
      const job = await api.packageInstall({ package: release.package, version: release.version });
      setInstallingJob((current) => ({
        ...current,
        [versionKey(release.package, release.version)]: job.id,
      }));
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  /** Không có `force` — refuse vì `services` không rỗng là chốt (D6). Vẽ danh sách, dừng ở đó. */
  async function uninstall(target: PackageSummary) {
    setError("");
    try {
      await api.packageUninstall({ package: target.package, version: target.version });
      void reload();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  return (
    <div className={styles.packages}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("mixengine.runtimes.columnVersion")}</th>
            <th>{t("mixengine.runtimes.columnInstalledAt")}</th>
            <th>{t("mixengine.runtimes.columnServices")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {installed.map((row) => {
            const key = versionKey(row.package, row.version);
            return (
              <tr key={key}>
                <td>
                  {row.package} {row.version}
                </td>
                <td>{row.installed_at}</td>
                <td>{row.services.length > 0 ? row.services.join(", ") : "—"}</td>
                <td className={styles.actions}>
                  <Button onClick={() => void uninstall(row)} disabled={row.services.length > 0}>
                    {t("mixengine.runtimes.uninstall")}
                  </Button>
                  {row.services.length > 0 && (
                    <p className={styles.blockedHint}>
                      {t("mixengine.runtimes.uninstallBlockedMessage", {
                        services: row.services.join(", "),
                      })}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>
        {t("mixengine.runtimes.columnVersion")} <StaleBadge stale={stale} />
      </h4>
      <table className={styles.table}>
        <tbody>
          {available
            .filter((release) => !release.installed)
            .map((release) => {
              const key = versionKey(release.package, release.version);
              const job = jobFor(jobs, installingJob[key]);
              return (
                <tr key={key}>
                  <td>
                    {release.package} {release.version}
                  </td>
                  <td className={styles.actions}>
                    {job ? (
                      <span className={styles.progress}>
                        <progress value={job.percent} max={100} />
                        {job.message}
                      </span>
                    ) : (
                      <Button onClick={() => void install(release)}>
                        {t("mixengine.runtimes.install")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
