import { useState } from "react";

import { useTranslation } from "../../../../i18n";
import * as api from "../../api";
import { describeOp } from "../../pendingOps";
import styles from "./ElevationDialog.module.css";

/**
 * Mọi thao tác đang chờ quyền quản trị, rồi một prompt.
 *
 * Danh sách hiện **trước** khi `elevation.grant` được gọi, vì thứ người ta sắp cho phép là thứ họ
 * được xem. Mỗi hàng nêu thao tác và, khi có, đúng những gì nó sẽ đổi — không dịch, vì đó là đường
 * dẫn và cổng thật.
 */
export default function ElevationDialog({
  pending,
  onClose,
}: {
  pending: unknown[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  async function decide(answer: "grant" | "drop") {
    setBusy(true);
    try {
      await (answer === "grant" ? api.elevationGrant() : api.elevationDrop());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-label={t("mixengine.elevation.title")}>
        <h2>{t("mixengine.elevation.title")}</h2>
        <p>{t("mixengine.elevation.lead")}</p>
        <ul className={styles.ops}>
          {pending.map((op, at) => {
            const { kind, description, detail } = describeOp(op);
            return (
              // Vị trí là khoá: `PendingOp.id` có tồn tại, nhưng thứ tự là thứ daemon gửi và danh
              // sách không sắp xếp lại, nên hai cách cho cùng một kết quả và cách này không phải
              // tin vào một field.
              <li key={at}>
                {/* Câu của daemon đứng trước; tên kỹ thuật đứng sau, cho người muốn tra cứu nó. */}
                {description && <div>{description}</div>}
                <code className={styles.kind}>{kind}</code>
                {detail && <pre className={styles.detail}>{detail}</pre>}
              </li>
            );
          })}
        </ul>
        <div className={styles.buttons}>
          <button onClick={() => void decide("drop")} disabled={busy}>
            {t("mixengine.elevation.drop")}
          </button>
          <button onClick={() => void decide("grant")} disabled={busy}>
            {t("mixengine.elevation.grant")}
          </button>
        </div>
      </div>
    </div>
  );
}
