import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import Button from "../../../../components/Button";
import Input from "../../../../components/Input";
import Modal from "../../../../components/Modal";
import Select from "../../../../components/Select";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { SiteDetail } from "../../api/types/SiteDetail";
import type { SiteKind } from "../../api/types/SiteKind";
import { joinDocRoot, parseDomains, relativeToRoot } from "../../siteState";
import styles from "./SiteForm.module.css";

type Kind = SiteKind["kind"];

interface Props {
  /** `undefined` = tạo mới. Có giá trị = sửa, khoá project lại. */
  initial?: SiteDetail;
  /** Chọn sẵn khi tạo mới — Sites truyền project đang lọc, nếu có. Bỏ qua khi `initial` có giá trị. */
  defaultProject?: string;
  onCancel: () => void;
  /** Gọi sau khi lưu xong — cha tự `reload()`. */
  onSaved: () => void;
}

export default function SiteForm({ initial, defaultProject, onCancel, onSaved }: Props) {
  const { t } = useTranslation();
  const editing = initial !== undefined;

  const [projectNames, setProjectNames] = useState<string[] | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const [project, setProject] = useState(
    editing && initial.site.owner.type === "project"
      ? initial.site.owner.name
      : (defaultProject ?? ""),
  );
  // Root của project sở hữu site — cho tạo mới, đọc lại mỗi khi đổi project (dưới); cho sửa,
  // `SiteDetail.root` đã có sẵn, project bị khoá nên không đổi nữa. Chỉ để hiển thị: giá trị gửi
  // lên daemon vẫn luôn là phần còn lại một mình (`docRoot`), đúng `SiteSummary.doc_root`.
  const [projectRoot, setProjectRoot] = useState(editing ? initial.root : "");
  const [domainsText, setDomainsText] = useState(editing ? initial.domains.join(", ") : "");
  const [docRoot, setDocRoot] = useState(editing ? initial.site.doc_root : "");
  const [kind, setKind] = useState<Kind>(editing ? initial.site.kind.kind : "php-fpm");
  const [pool, setPool] = useState(
    editing && initial.site.kind.kind === "php-fpm" ? (initial.site.kind.pool ?? "") : "",
  );
  const [upstream, setUpstream] = useState(
    editing && initial.site.kind.kind === "reverse-proxy" ? initial.site.kind.upstream : "",
  );
  const [port, setPort] = useState(
    editing && initial.site.kind.kind === "node-app" ? String(initial.site.kind.port) : "",
  );
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(editing ? initial.services.map((s) => s.service) : []),
  );
  const [https, setHttps] = useState(editing ? initial.site.https : false);
  const [acceptRiskyTld, setAcceptRiskyTld] = useState(false);
  const [enabled, setEnabled] = useState(editing ? initial.site.state === "enabled" : true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([api.projects(), api.services()]).then(([projectList, serviceList]) => {
      setProjectNames(projectList.projects.map((p) => p.name));
      setServiceIds(serviceList.services.map((s) => s.id));
    });
  }, []);

  // Chỉ cho tạo mới — sửa thì project bị khoá và `initial.root` đã là root đúng, không đổi nữa.
  useEffect(() => {
    if (editing) return;
    if (project === "") {
      setProjectRoot("");
      return;
    }
    let live = true;
    void api
      .projectShow(project)
      .then((detail) => {
        if (live) setProjectRoot(detail.project.root);
      })
      .catch(() => {
        if (live) setProjectRoot("");
      });
    return () => {
      live = false;
    };
  }, [editing, project]);

  const domains = parseDomains(domainsText);
  const needsRiskyTldConsent = domains.some((d) => d.endsWith(".local"));
  const noProjects = !editing && projectNames !== null && projectNames.length === 0;

  function toggleService(id: string) {
    setSelectedServices((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function kindPayload(): SiteKind {
    switch (kind) {
      case "php-fpm":
        return { kind: "php-fpm", pool: pool === "" ? null : pool };
      case "static":
        return { kind: "static" };
      case "reverse-proxy":
        return { kind: "reverse-proxy", upstream };
      case "node-app":
        return { kind: "node-app", port: Number(port) };
    }
  }

  /**
   * Dialog luôn trả một đường dẫn tuyệt đối — cắt bỏ phần project root trước khi lưu vào state, vì
   * đó là hình dạng thật `SiteSummary.doc_root` giữ ("Relative to the project's root, as stored").
   * Không cắt thì ô này hiện tuyệt đối ngay sau khi chọn nhưng lại hiện phần còn lại sau khi lưu
   * rồi mở lại — hai lần hiện khác nhau cho cùng một site.
   *
   * `defaultPath` mở sẵn đúng chỗ đang chọn (root, hoặc root/doc_root hiện tại) để bấm Browse là
   * đi thẳng vào project, không phải mò lại từ đầu ổ đĩa.
   */
  async function browseDocRoot() {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: projectRoot === "" ? undefined : joinDocRoot(projectRoot, docRoot),
    });
    if (typeof picked !== "string") return;
    setDocRoot(projectRoot === "" ? picked : relativeToRoot(projectRoot, picked));
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.siteUpdate({
          site: { domain: initial.site.domain },
          domains,
          doc_root: docRoot,
          kind: kindPayload(),
          services: [...selectedServices],
          https,
          state: enabled ? "enabled" : "disabled",
          accept_risky_tld: acceptRiskyTld,
        });
      } else {
        await api.siteCreate({
          project: { name: project },
          domains: domains.length > 0 ? domains : null,
          doc_root: docRoot === "" ? null : docRoot,
          kind: kindPayload(),
          services: [...selectedServices].length > 0 ? [...selectedServices] : null,
          https,
          accept_risky_tld: acceptRiskyTld,
        });
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
      label={t(editing ? "mixengine.sites.form.editTitle" : "mixengine.sites.form.createTitle")}
      onClose={onCancel}
      locked={saving}
      overlayClassName={styles.overlay}
      className={styles.dialog}
    >
      {(close) => (
        <>
          <h3 className={styles.title}>
            {t(editing ? "mixengine.sites.form.editTitle" : "mixengine.sites.form.createTitle")}
          </h3>

          <div className={styles.form}>
            {!editing && (
              <label className={styles.field}>
                {t("mixengine.sites.form.project")}
                {noProjects ? (
                  <p className={styles.hint}>{t("mixengine.sites.form.noProjects")}</p>
                ) : (
                  <Select
                    value={project}
                    onChange={setProject}
                    disabled={projectNames === null || saving}
                    options={(projectNames ?? []).map((name) => ({ value: name, label: name }))}
                    placeholder={t("mixengine.sites.form.project")}
                  />
                )}
              </label>
            )}

            <label className={styles.field}>
              {t("mixengine.sites.form.domains")}
              <textarea
                className={styles.textarea}
                value={domainsText}
                disabled={saving}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder={t("mixengine.sites.form.domainsPlaceholder")}
              />
            </label>

            {needsRiskyTldConsent && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={acceptRiskyTld}
                  disabled={saving}
                  onChange={(e) => setAcceptRiskyTld(e.target.checked)}
                />
                {t("mixengine.sites.form.acceptRiskyTld")}
              </label>
            )}

            <label className={styles.field}>
              {t("mixengine.sites.form.docRoot")}
              <div className={styles.docRoot}>
                <Input
                  value={docRoot}
                  disabled={saving}
                  onChange={(e) => setDocRoot(e.target.value)}
                />
                <Button onClick={() => void browseDocRoot()} disabled={saving}>
                  {t("common.browse")}
                </Button>
              </div>
              {/* Ô trên chỉ giữ phần còn lại sau root (đúng cái daemon lưu) — dòng này là chỗ
                  duy nhất người dùng thấy root của project và đường dẫn đầy đủ thật sự là gì. */}
              {projectRoot !== "" && (
                <p className={styles.hint}>
                  {t("mixengine.sites.form.docRootFull", {
                    path: joinDocRoot(projectRoot, docRoot),
                  })}
                </p>
              )}
            </label>

            <label className={styles.field}>
              {t("mixengine.sites.form.kind")}
              <Select
                value={kind}
                disabled={saving}
                onChange={(value) => setKind(value)}
                options={[
                  { value: "php-fpm", label: "php-fpm" },
                  { value: "static", label: "static" },
                  { value: "reverse-proxy", label: "reverse-proxy" },
                  { value: "node-app", label: "node-app" },
                ]}
              />
            </label>

            {kind === "php-fpm" && (
              <label className={styles.field}>
                {t("mixengine.sites.form.pool")}
                <Select
                  value={pool}
                  disabled={saving}
                  onChange={setPool}
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

            {kind === "reverse-proxy" && (
              <label className={styles.field}>
                {t("mixengine.sites.form.upstream")}
                <Input
                  value={upstream}
                  disabled={saving}
                  onChange={(e) => setUpstream(e.target.value)}
                  placeholder="http://127.0.0.1:3000"
                />
              </label>
            )}

            {kind === "node-app" && (
              <label className={styles.field}>
                {t("mixengine.sites.form.port")}
                <Input
                  type="number"
                  value={port}
                  disabled={saving}
                  onChange={(e) => setPort(e.target.value)}
                />
              </label>
            )}

            <div className={styles.field}>
              {t("mixengine.sites.form.services")}
              <div className={styles.serviceList}>
                {serviceIds.map((id) => (
                  <label key={id} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={selectedServices.has(id)}
                      disabled={saving}
                      onChange={() => toggleService(id)}
                    />
                    {id}
                  </label>
                ))}
              </div>
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={https}
                disabled={saving}
                onChange={(e) => setHttps(e.target.checked)}
              />
              {t("mixengine.sites.form.https")}
            </label>

            {editing && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={saving}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                {t("mixengine.sites.form.enabled")}
              </label>
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
              disabled={saving || (!editing && (project === "" || noProjects))}
            >
              {saving ? t("mixengine.sites.form.saving") : t("common.save")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
