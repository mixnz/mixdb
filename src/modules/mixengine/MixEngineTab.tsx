import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { useTranslation } from "../../i18n";
import type { ModuleTabProps } from "../../shell/module";
import * as api from "./api";
import Dashboard from "./screens/Dashboard";
import { parseMixEngineTabState } from "./tabState";
import "./mixengine.css";

/** Trang cài đặt của MixEngine, cho một máy chưa có nó. */
const INSTALL_PAGE = "https://mixnz.github.io/mixengine/en/install/";

/**
 * Cổng vào module, rồi màn hình.
 *
 * **Ba trạng thái, không phải hai.** *Không chạy* (không dial được nhưng chương trình có trên máy),
 * *không trả lời* (dial được, `/health` không xong), *không có MixEngine*. Gộp cả ba thành một
 * thông báo lỗi là bắt người dùng đoán xem họ phải cài, phải khởi động, hay phải chờ.
 *
 * **Không tự khởi động daemon khi mở tab.** Mở một tab là một cử chỉ rẻ và người dùng có thể chỉ
 * đang tìm nhầm tab; khởi động một daemon đang giám sát database thì không rẻ như vậy. Nút nói rõ
 * nó sắp làm gì.
 */
export default function MixEngineTab({ onTitleChange, restored }: ModuleTabProps) {
  // Đọc một lần, lúc mount — đọc reactively là module tự ghi đè chính nó ngay khi nó ghi.
  const [screen] = useState(() => parseMixEngineTabState(restored)?.screen ?? "dashboard");
  const [presence, setPresence] = useState<api.Presence | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const look = useCallback(async () => {
    setPresence(await api.presence());
  }, []);

  useEffect(() => {
    let live = true;
    void api.presence().then((answer) => {
      if (live) setPresence(answer);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    onTitleChange(t("mixengine.newTabTitle"));
  }, [onTitleChange, t]);

  async function start() {
    setBusy(true);
    try {
      await api.startDaemon();
      await look();
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      await look();
    } finally {
      setBusy(false);
    }
  }

  // Chưa hỏi xong: một khung trống, không phải một thông báo. Câu trả lời tới trong vài mili giây
  // và một dòng "đang kiểm tra" nhấp nháy thì tệ hơn là không có gì.
  if (presence === null) return <div className="mixengine-root" />;

  if (presence !== "running") {
    return (
      <div className="mixengine-root mixengine-gate">
        <p>{t(`mixengine.gate.${presence}`)}</p>
        {presence === "notRunning" && (
          <button onClick={() => void start()} disabled={busy}>
            {busy ? t("mixengine.gate.starting") : t("mixengine.gate.start")}
          </button>
        )}
        {presence === "notAnswering" && (
          <button onClick={() => void retry()} disabled={busy}>
            {t("mixengine.gate.retry")}
          </button>
        )}
        {presence === "notInstalled" && (
          <button onClick={() => void openUrl(INSTALL_PAGE)}>{t("mixengine.gate.getIt")}</button>
        )}
      </div>
    );
  }

  return <div className="mixengine-root">{screen === "dashboard" && <Dashboard />}</div>;
}
