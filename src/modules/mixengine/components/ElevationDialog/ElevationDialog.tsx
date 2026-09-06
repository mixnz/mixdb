import { useState } from "react";

import Button from "../../../../components/Button";
import Modal from "../../../../components/Modal";
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
 *
 * **Không có nút "Bỏ qua".** `elevation.drop` bỏ cả lô mà không để lại cách nào cấp lại — đóng hộp
 * thoại (Escape, bấm ra ngoài, hay nút Đóng) chỉ ẩn nó đi, số đang chờ ở Dashboard vẫn còn nguyên
 * và bấm lại mở ra đúng danh sách này.
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

  async function grant() {
    setBusy(true);
    try {
      await api.elevationGrant();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      label={t("mixengine.elevation.title")}
      onClose={onClose}
      locked={busy}
      overlayClassName={styles.overlay}
      className={styles.dialog}
    >
      {(close) => (
        <>
          <h2 className={styles.title}>{t("mixengine.elevation.title")}</h2>
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
            <Button size="large" onClick={() => close(onClose)} disabled={busy}>
              {t("common.close")}
            </Button>
            <Button size="large" variant="primary" onClick={() => void grant()} disabled={busy}>
              {t("mixengine.elevation.grant")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
