import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import Button from "../../../../components/Button";
import Input from "../../../../components/Input";
import Modal from "../../../../components/Modal";
import { errorMessage } from "../../../../core/errors";
import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import type { ProjectDetail } from "../../api/types/ProjectDetail";
import type { RuntimeKind } from "../../api/types/RuntimeKind";
import styles from "./ProjectForm.module.css";

const RUNTIME_KINDS: readonly RuntimeKind[] = ["php", "node", "python", "ruby"];

interface Props {
  /** `undefined` = tạo mới. Có giá trị = sửa. */
  initial?: ProjectDetail;
  onCancel: () => void;
  /** Gọi sau khi lưu xong — cha tự `reload()`. */
  onSaved: () => void;
}

export default function ProjectForm({ initial, onCancel, onSaved }: Props) {
  const { t } = useTranslation();
  const editing = initial !== undefined;

  const [root, setRoot] = useState(editing ? initial.project.root : "");
  const [name, setName] = useState(editing ? initial.project.name : "");
  const [keepWarm, setKeepWarm] = useState(editing ? initial.project.keep_warm : false);
  const [pins, setPins] = useState<Record<RuntimeKind, string>>(() => {
    const initialPins: Record<RuntimeKind, string> = { php: "", node: "", python: "", ruby: "" };
    if (editing) {
      for (const pin of initial.pins) initialPins[pin.kind] = pin.constraint;
    }
    return initialPins;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      } else {
        await api.projectCreate({
          root,
          name: name.trim() === "" ? undefined : name,
          pins: pinsPayload(),
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

            {editing && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={keepWarm}
                  disabled={saving}
                  onChange={(e) => setKeepWarm(e.target.checked)}
                />
                {t("mixengine.projects.form.keepWarm")}
              </label>
            )}

            <details className={styles.advanced}>
              <summary>{t("mixengine.projects.form.pinsSummary")}</summary>
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
            </details>
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
