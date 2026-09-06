import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import ErrorBanner from "../../components/ErrorBanner";
import { errorMessage } from "../../core/errors";
import { useTranslation, type Language } from "../../i18n";
import type { ModuleTabProps } from "../../shell/module";
import * as api from "./api";
import Sidebar from "./components/Sidebar";
import Blueprints from "./screens/Blueprints";
import Dashboard from "./screens/Dashboard";
import Domains from "./screens/Domains";
import Extensions from "./screens/Extensions";
import Logs from "./screens/Logs";
import Projects from "./screens/Projects";
import Runtimes from "./screens/Runtimes";
import ServicesDetail from "./screens/ServicesDetail";
import Sites from "./screens/Sites";
import { parseMixEngineTabState, type MixEngineScreen } from "./tabState";
import "./mixengine.css";

/** Trang cài đặt của MixEngine, cho một máy chưa có nó. */
const INSTALL_PAGE_EN = "https://mixnz.github.io/mixengine/en/install/";
/** Only languages with a translated install page go here; everything else falls back to English. */
const INSTALL_PAGE_BY_LANG: Partial<Record<Language, string>> = {
  vi: "https://mixnz.github.io/mixengine/vi/install/",
};

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
export default function MixEngineTab({ onTitleChange, onStateChange, restored }: ModuleTabProps) {
  // Đọc một lần, lúc mount — đọc reactively là module tự ghi đè chính nó ngay khi nó ghi.
  const [screen, setScreen] = useState<MixEngineScreen>(
    () => parseMixEngineTabState(restored)?.screen ?? "dashboard",
  );
  const [presence, setPresence] = useState<api.Presence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { t, lang } = useTranslation();

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

  /* Khởi động một daemon hỏng được vì nhiều lý do người dùng sửa được — chương trình không ở chỗ
     đoán, một daemon khác đang giữ lock. Nuốt cái đó đi là để họ bấm một cái nút không làm gì. */
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await look();
    } catch (e) {
      setError(errorMessage(t, e));
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
        {error !== "" && <ErrorBanner message={error} onDismiss={() => setError("")} />}
        <p>{t(`mixengine.gate.${presence}`)}</p>
        {presence === "notRunning" && (
          <button onClick={() => void run(api.startDaemon)} disabled={busy}>
            {busy ? t("mixengine.gate.starting") : t("mixengine.gate.start")}
          </button>
        )}
        {presence === "notAnswering" && (
          <button onClick={() => void run(() => Promise.resolve())} disabled={busy}>
            {t("mixengine.gate.retry")}
          </button>
        )}
        {presence === "notInstalled" && (
          <button onClick={() => void openUrl(INSTALL_PAGE_BY_LANG[lang] ?? INSTALL_PAGE_EN)}>
            {t("mixengine.gate.getIt")}
          </button>
        )}
      </div>
    );
  }

  function selectScreen(next: MixEngineScreen) {
    setScreen(next);
    onStateChange({ screen: next });
  }

  return (
    <div className="mixengine-root mixengine-layout">
      <Sidebar screen={screen} onSelect={selectScreen} />
      <div className="mixengine-screen">
        {screen === "dashboard" && <Dashboard />}
        {screen === "projects" && <Projects />}
        {screen === "sites" && <Sites />}
        {screen === "domains" && <Domains />}
        {screen === "runtimes" && <Runtimes />}
        {screen === "servicesDetail" && <ServicesDetail />}
        {screen === "logs" && <Logs />}
        {screen === "blueprints" && <Blueprints />}
        {screen === "extensions" && <Extensions />}
      </div>
    </div>
  );
}
