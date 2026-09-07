import { useCallback, useEffect, useState } from "react";

import Button from "../../../../components/Button";
import ErrorBanner from "../../../../components/ErrorBanner";
import Select from "../../../../components/Select";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { SiteDetail } from "../../api/types/SiteDetail";
import type { SiteSharing } from "../../api/types/SiteSharing";
import { subscribeDaemonWatch } from "../../daemonWatch";
import { applySharingChange, canEditSite, formatRemaining, type SiteRow } from "../../siteState";
import { takePendingSitesFilter } from "../../sitesNavigation";
import ShareDialog from "./ShareDialog";
import SiteForm from "./SiteForm";
import styles from "./Sites.module.css";

/** Ô chia sẻ: nút Chia sẻ khi chưa, đếm ngược sống + nút Bỏ chia sẻ khi đang. */
function SharingCell({
  sharing,
  onShare,
  onUnshare,
}: {
  sharing: SiteSharing | null | undefined;
  onShare: () => void;
  onUnshare: () => void;
}) {
  const { t } = useTranslation();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!sharing?.until) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [sharing?.until]);

  if (!sharing) {
    return (
      <Button onClick={onShare} size="small">
        {t("mixengine.sites.share.share")}
      </Button>
    );
  }

  return (
    <span className={styles.sharing}>
      {sharing.until ? formatRemaining(sharing.until) : t("mixengine.sites.sharingIndefinite")}
      <Button onClick={onUnshare} size="small">
        {t("mixengine.sites.share.unshare")}
      </Button>
    </span>
  );
}

/**
 * Mọi site trong home, và trạng thái chia sẻ LAN của chúng.
 *
 * **Chia sẻ đến từ stream, không từ suy đoán** — `site_sharing_changed` là chỗ roadmap gọi là "chỗ
 * duy nhất `mix` là client yếu hơn": với CLI lý do nằm trong log không ai đọc, ở đây nó phải là một
 * dòng thấy được ngay khi nó tới.
 */
export default function Sites({ active }: { active: boolean }) {
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SiteDetail | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const { t } = useTranslation();

  const reload = useCallback(async () => {
    try {
      const list = await api.sites(projectFilter === "" ? undefined : projectFilter);
      setRows(list.sites);
      setError("");
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }, [projectFilter, t]);

  useEffect(() => {
    void api.projects().then((list) => setProjectNames(list.projects.map((p) => p.name)));
  }, []);

  // Projects đặt một yêu cầu điều hướng ("mở Sites, lọc theo project X") qua `sitesNavigation.ts`
  // rồi chuyển sang màn này — đọc đúng lúc `active` chuyển `true`, trước khi `reload()` chạy, để
  // lần đọc đầu tiên khi quay lại màn đã lọc đúng thay vì lọc "tất cả" rồi phải sửa tay.
  useEffect(() => {
    if (!active) return;
    const requested = takePendingSitesFilter();
    if (requested !== null) setProjectFilter(requested);
  }, [active]);

  // Đọc lại lúc mount và mỗi lần vừa quay lại màn này — cùng lý do `Dashboard.tsx`.
  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);

  useEffect(() => {
    return subscribeDaemonWatch((raw) => {
      setRows((current) => applySharingChange(current, raw));
    });
  }, []);

  async function edit(domain: string) {
    try {
      setEditing(await api.site(domain));
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  /**
   * Bỏ chia sẻ. Cập nhật hàng ngay khi call trả về, không đợi `site_sharing_changed` — sự kiện đó
   * là cho lúc nó **tự** đổi (hết giờ, mất mạng), không phải cho lúc người dùng vừa bấm.
   */
  async function unshare(domain: string) {
    try {
      await api.siteUnshare(domain);
      setRows((current) =>
        current.map((row) => (row.domain === domain ? { ...row, sharing: null } : row)),
      );
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  return (
    <div className={styles.sites}>
      {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <div className={styles.toolbar}>
        <Select
          value={projectFilter}
          onChange={setProjectFilter}
          searchable
          options={[
            { value: "", label: t("mixengine.sites.filterAllProjects") },
            ...projectNames.map((name) => ({ value: name, label: name })),
          ]}
        />
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t("mixengine.sites.newSite")}
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("mixengine.sites.columnDomain")}</th>
              <th>{t("mixengine.sites.columnOwner")}</th>
              <th>{t("mixengine.sites.columnKind")}</th>
              <th>{t("mixengine.sites.columnHttps")}</th>
              <th>{t("mixengine.sites.columnState")}</th>
              <th>{t("mixengine.sites.columnSharing")}</th>
              <th>{t("mixengine.sites.columnActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.domain}>
                <td>{row.domain}</td>
                <td>
                  {row.owner.type === "project"
                    ? t("mixengine.sites.ownerProject", { name: row.owner.name })
                    : t("mixengine.sites.ownerExtension", { id: row.owner.id })}
                  {!canEditSite(row.owner) && (
                    <span className={styles.readOnly} title={t("mixengine.sites.editDisabledHint")}>
                      {" "}
                      🔒
                    </span>
                  )}
                </td>
                <td>{row.kind.kind}</td>
                <td>{row.https ? "✓" : "—"}</td>
                <td>{row.state}</td>
                <td>
                  <SharingCell
                    sharing={row.sharing}
                    onShare={() => setSharing(row.domain)}
                    onUnshare={() => void unshare(row.domain)}
                  />
                </td>
                <td>
                  <Button onClick={() => void edit(row.domain)} disabled={!canEditSite(row.owner)}>
                    {t("mixengine.sites.edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className={styles.empty}>{t("mixengine.sites.empty")}</p>}

      {creating && (
        <SiteForm
          defaultProject={projectFilter === "" ? undefined : projectFilter}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}

      {editing && (
        <SiteForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}

      {sharing && (
        <ShareDialog
          domain={sharing}
          onCancel={() => setSharing(null)}
          onShared={(next) => {
            setRows((current) =>
              current.map((row) => (row.domain === sharing ? { ...row, sharing: next } : row)),
            );
            setSharing(null);
          }}
        />
      )}
    </div>
  );
}
