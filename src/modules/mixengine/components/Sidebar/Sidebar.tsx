import { useTranslation, type TranslationKey } from "../../../../i18n";
import type { MixEngineScreen } from "../../tabState";
import styles from "./Sidebar.module.css";

/**
 * Chín mục cố định của `client-surface.md`, cộng một mục MixDB tự thêm.
 *
 * **`projects` không nằm trong 9 màn hình `client-surface.md` liệt kê.** `client-surface.md` không
 * dựng Projects thành một màn hình riêng — nó giả định một client hỏi `project.list` cho đúng một
 * dropdown. MixDB dựng hẳn một màn hình quản lý vì `project.*` đã có đủ method
 * (`list, create, show, update, delete, export`) cho một màn hình đầy đủ, và vì Sites (mục ngay sau)
 * không dùng được nếu chưa có project nào — xem Quyết định D4,
 * `docs/superpowers/specs/2026-09-06-mixengine-runtimes-services-logs-design.md`. Đặt ngay sau
 * Dashboard vì nó là thứ Sites cần trước.
 *
 * **Sáu mục còn lại xám, không ẩn hẳn.** Một mục biến mất khỏi danh sách không nói gì cả và không ai
 * biết còn sáu màn hình nữa đang tới; một mục xám không bấm được là một lời hứa còn giữ được — cùng
 * luật Pha 1 đã theo cho Dashboard/Services.
 */
const ITEMS: readonly { screen: MixEngineScreen | null; labelKey: TranslationKey }[] = [
  { screen: "dashboard", labelKey: "mixengine.sidebar.dashboard" },
  { screen: "projects", labelKey: "mixengine.sidebar.projects" },
  { screen: "sites", labelKey: "mixengine.sidebar.sites" },
  { screen: "domains", labelKey: "mixengine.sidebar.domains" },
  { screen: null, labelKey: "mixengine.sidebar.runtimes" },
  { screen: null, labelKey: "mixengine.sidebar.servicesDetail" },
  { screen: null, labelKey: "mixengine.sidebar.logs" },
  { screen: null, labelKey: "mixengine.sidebar.blueprints" },
  { screen: null, labelKey: "mixengine.sidebar.extensions" },
  { screen: null, labelKey: "mixengine.sidebar.settings" },
];

export default function Sidebar({
  screen,
  onSelect,
}: {
  screen: MixEngineScreen;
  onSelect: (screen: MixEngineScreen) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav className={styles.sidebar} aria-label={t("mixengine.sidebar.label")}>
      {ITEMS.map((item) => (
        <button
          key={item.labelKey}
          type="button"
          className={styles.item}
          disabled={item.screen === null}
          aria-current={item.screen !== null && item.screen === screen ? "page" : undefined}
          onClick={() => item.screen !== null && onSelect(item.screen)}
        >
          {t(item.labelKey)}
        </button>
      ))}
    </nav>
  );
}
