import { useEffect, useState, type ReactNode } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import Button from "../../../../components/Button";
import Input from "../../../../components/Input";
import Modal from "../../../../components/Modal";
import Select from "../../../../components/Select";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import { ChevronRightIcon } from "../../../../icons";
import * as api from "../../api";
import type { ProjectDetail } from "../../api/types/ProjectDetail";
import type { RuntimeKind } from "../../api/types/RuntimeKind";
import type { SiteKind } from "../../api/types/SiteKind";
import { parseDomains } from "../../siteState";
import styles from "./ProjectForm.module.css";

const RUNTIME_KINDS: readonly RuntimeKind[] = ["php", "node", "python", "ruby"];
type Kind = SiteKind["kind"];

/**
 * Một khối gấp/mở dựng tay — thay cho `<details>` gốc vì hai lý do:
 *
 * **Icon và chuyển động tự chọn được.** `<details>` chỉ có tam giác mặc định của trình duyệt,
 * không đổi được kiểu hay tốc độ. Ở đây một `ChevronRightIcon` xoay 90° khi mở, cùng khuôn với
 * chevron của `Select` (`Select.module.css`).
 *
 * **Chiều cao đổi mượt, không nhảy khựng.** Chiều cao đi từ `0fr` lên `1fr` trên chính
 * `grid-template-rows` — kỹ thuật animate về `auto` không cần đo bằng JS. `<details>` đổi chiều cao
 * tức thì trong một frame, và đó chính là thứ khiến `Modal` không kịp canh lại giữa màn hình (xem
 * `dialogMotion.ts`, `onEntered`) trước khi có phần này.
 */
function Disclosure({
  summary,
  defaultOpen = false,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={styles.disclosureSummary}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRightIcon
          size="1.1em"
          className={`${styles.disclosureChevron} ${open ? styles.disclosureChevronOpen : ""}`}
        />
        {summary}
      </button>
      <div className={`${styles.disclosureBody} ${open ? styles.disclosureBodyOpen : ""}`}>
        <div className={styles.disclosureInner}>{children}</div>
      </div>
    </div>
  );
}

interface Props {
  /** `undefined` = tạo mới. Có giá trị = sửa. */
  initial?: ProjectDetail;
  onCancel: () => void;
  /** Gọi sau khi lưu xong — cha tự `reload()`. `warning` có giá trị khi project đã tạo xong nhưng
   *  site đi kèm (mục "tạo nhanh site") thất bại — project vẫn coi là đã lưu, cha tự vẽ cảnh báo. */
  onSaved: (warning?: string) => void;
}

export default function ProjectForm({ initial, onCancel, onSaved }: Props) {
  const { t } = useTranslation();
  const editing = initial !== undefined;

  const [root, setRoot] = useState(editing ? initial.project.root : "");
  const [name, setName] = useState(editing ? initial.project.name : "");
  // Mặc định tick khi tạo mới: một project mới thường vẫn đang được cấu hình, chưa muốn nó tự
  // dừng service giữa chừng. `project.create` không nhận `keep_warm` — tạo xong, `submit()` tự gọi
  // thêm `project.update` nếu ô này vẫn đang tick.
  const [keepWarm, setKeepWarm] = useState(editing ? initial.project.keep_warm : true);
  const [pins, setPins] = useState<Record<RuntimeKind, string>>(() => {
    const initialPins: Record<RuntimeKind, string> = { php: "", node: "", python: "", ruby: "" };
    if (editing) {
      for (const pin of initial.pins) initialPins[pin.kind] = pin.constraint;
    }
    return initialPins;
  });

  // "Tạo nhanh site" — chỉ hiện lúc tạo project mới (xem JSX). Bỏ trống domains là bỏ qua hẳn bước
  // này, không phải một site rỗng gửi lên daemon.
  const [siteDomainsText, setSiteDomainsText] = useState("");
  const [siteKind, setSiteKind] = useState<Kind>("php-fpm");
  const [sitePool, setSitePool] = useState("");
  const [siteUpstream, setSiteUpstream] = useState("");
  const [sitePort, setSitePort] = useState("");
  const [siteHttps, setSiteHttps] = useState(false);
  const [siteAcceptRiskyTld, setSiteAcceptRiskyTld] = useState(false);
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editing) return;
    void api.services().then((list) => setServiceIds(list.services.map((s) => s.id)));
  }, [editing]);

  async function browseRoot() {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string") setRoot(picked);
  }

  function pinsPayload(): Partial<Record<RuntimeKind, string>> | undefined {
    const entries = RUNTIME_KINDS.filter((kind) => pins[kind].trim() !== "").map((kind) => [
      kind,
      pins[kind].trim(),
    ]);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  const siteDomains = parseDomains(siteDomainsText);
  const siteNeedsRiskyTldConsent = siteDomains.some((d) => d.endsWith(".local"));

  function siteKindPayload(): SiteKind {
    switch (siteKind) {
      case "php-fpm":
        return { kind: "php-fpm", pool: sitePool === "" ? null : sitePool };
      case "static":
        return { kind: "static" };
      case "reverse-proxy":
        return { kind: "reverse-proxy", upstream: siteUpstream };
      case "node-app":
        return { kind: "node-app", port: Number(sitePort) };
    }
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.projectUpdate({
          project: { name: initial.project.name },
          name: name !== initial.project.name ? name : undefined,
          root: root !== initial.project.root ? root : undefined,
          pins: pinsPayload() ?? {},
          keep_warm: keepWarm,
        });
        onSaved();
        return;
      }

      const created = await api.projectCreate({
        root,
        name: name.trim() === "" ? undefined : name,
        pins: pinsPayload(),
      });
      // `project.create` không có tham số `keep_warm` — đây là cách duy nhất áp nó ngay từ lúc
      // tạo. Bỏ qua khi vẫn đang tắt: mặc định phía daemon cho một project mới đã là tắt.
      //
      // `created.project.name`, không phải `created.name` — `project.create` trả `ProjectDetail
      // { project, pins }`, không phải một `ProjectSummary` trần. Đọc nhầm tầng này gửi
      // `project: { name: undefined }` xuống `project.update`, JSON bỏ luôn field rỗng, và
      // daemon từ chối với "invalid value: map, expected map with a single key" — đúng lỗi đã
      // báo.
      if (keepWarm) {
        await api.projectUpdate({ project: { name: created.project.name }, keep_warm: true });
      }

      if (siteDomains.length > 0) {
        try {
          await api.siteCreate({
            project: { name: created.project.name },
            domains: siteDomains,
            doc_root: null,
            kind: siteKindPayload(),
            services: null,
            https: siteHttps,
            accept_risky_tld: siteAcceptRiskyTld,
          });
        } catch (e) {
          // Project đã lưu xong — đây là một cảnh báo về riêng cái site, không phải một lần lưu
          // thất bại. Đóng dialog vẫn đúng: mở lại nó chỉ để gõ lại y hệt phần project sẽ đụng
          // ngay lỗi "tên đã tồn tại", vì `project.create` vừa chạy xong thật.
          onSaved(t("mixengine.projects.form.siteFailed", { error: errorMessage(t, e) }));
          return;
        }
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      label={t(editing ? "mixengine.projects.form.editTitle" : "mixengine.projects.form.createTitle")}
      onClose={onCancel}
      locked={saving}
      overlayClassName={styles.overlay}
      className={styles.dialog}
    >
      {(close) => (
        <>
          <h3 className={styles.title}>
            {t(editing ? "mixengine.projects.form.editTitle" : "mixengine.projects.form.createTitle")}
          </h3>

          <div className={styles.form}>
            <label className={styles.field}>
              {t("mixengine.projects.form.root")}
              <div className={styles.rootRow}>
                <Input value={root} disabled={saving} onChange={(e) => setRoot(e.target.value)} />
                <Button onClick={() => void browseRoot()} disabled={saving}>
                  {t("common.browse")}
                </Button>
              </div>
              {editing && <p className={styles.hint}>{t("mixengine.projects.form.rootMovedHint")}</p>}
            </label>

            <label className={styles.field}>
              {t("mixengine.projects.form.name")}
              <Input
                value={name}
                disabled={saving}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("mixengine.projects.form.namePlaceholder")}
              />
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={keepWarm}
                disabled={saving}
                onChange={(e) => setKeepWarm(e.target.checked)}
              />
              {t("mixengine.projects.form.keepWarm")}
            </label>

            <Disclosure summary={t("mixengine.projects.form.pinsSummary")}>
              {RUNTIME_KINDS.map((kind) => (
                <label key={kind} className={styles.field}>
                  {kind}
                  <Input
                    value={pins[kind]}
                    disabled={saving}
                    onChange={(e) => setPins((prev) => ({ ...prev, [kind]: e.target.value }))}
                  />
                </label>
              ))}
            </Disclosure>

            {/* Chỉ ở form tạo mới — sửa một project đã có không phải lúc để gộp thêm một site,
                site của nó (nếu có) đã sửa được riêng ở màn Sites. */}
            {!editing && (
              <Disclosure summary={t("mixengine.projects.form.quickSiteSummary")}>
                <label className={styles.field}>
                  {t("mixengine.sites.form.domains")}
                  <textarea
                    className={styles.textarea}
                    value={siteDomainsText}
                    disabled={saving}
                    onChange={(e) => setSiteDomainsText(e.target.value)}
                    placeholder={t("mixengine.sites.form.domainsPlaceholder")}
                  />
                </label>

                {siteNeedsRiskyTldConsent && (
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={siteAcceptRiskyTld}
                      disabled={saving}
                      onChange={(e) => setSiteAcceptRiskyTld(e.target.checked)}
                    />
                    {t("mixengine.sites.form.acceptRiskyTld")}
                  </label>
                )}

                <label className={styles.field}>
                  {t("mixengine.sites.form.kind")}
                  <Select
                    value={siteKind}
                    disabled={saving}
                    onChange={(value) => setSiteKind(value)}
                    options={[
                      { value: "php-fpm", label: "php-fpm" },
                      { value: "static", label: "static" },
                      { value: "reverse-proxy", label: "reverse-proxy" },
                      { value: "node-app", label: "node-app" },
                    ]}
                  />
                </label>

                {siteKind === "php-fpm" && (
                  <label className={styles.field}>
                    {t("mixengine.sites.form.pool")}
                    <Select
                      value={sitePool}
                      disabled={saving}
                      onChange={setSitePool}
                      placeholder={t("mixengine.sites.form.poolAuto")}
                      options={[
                        { value: "", label: t("mixengine.sites.form.poolAuto") },
                        ...serviceIds
                          .filter((id) => id.startsWith("php-fpm@"))
                          .map((id) => ({ value: id, label: id })),
                      ]}
                    />
                  </label>
                )}

                {siteKind === "reverse-proxy" && (
                  <label className={styles.field}>
                    {t("mixengine.sites.form.upstream")}
                    <Input
                      value={siteUpstream}
                      disabled={saving}
                      onChange={(e) => setSiteUpstream(e.target.value)}
                      placeholder="http://127.0.0.1:3000"
                    />
                  </label>
                )}

                {siteKind === "node-app" && (
                  <label className={styles.field}>
                    {t("mixengine.sites.form.port")}
                    <Input
                      type="number"
                      value={sitePort}
                      disabled={saving}
                      onChange={(e) => setSitePort(e.target.value)}
                    />
                  </label>
                )}

                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={siteHttps}
                    disabled={saving}
                    onChange={(e) => setSiteHttps(e.target.checked)}
                  />
                  {t("mixengine.sites.form.https")}
                </label>
              </Disclosure>
            )}
          </div>

          {error !== "" && (
            <div className={styles.errors} role="alert">
              <p>{error}</p>
            </div>
          )}

          <div className={styles.actions}>
            <Button size="large" onClick={() => close(onCancel)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button
              size="large"
              variant="primary"
              onClick={() => void submit()}
              disabled={saving || root.trim() === ""}
            >
              {saving ? t("mixengine.projects.form.saving") : t("common.save")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
