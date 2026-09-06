import { useTranslation, type TranslationKey } from "../../../../i18n";
import type { MixEngineScreen } from "../../tabState";
import styles from "./Sidebar.module.css";

/**
 * Chín mục cố định của `client-surface.md`, ba mục bật.
 *
 * **Sáu mục còn lại xám, không ẩn hẳn.** Một mục biến mất khỏi danh sách không nói gì cả và không ai
 * biết còn sáu màn hình nữa đang tới; một mục xám không bấm được là một lời hứa còn giữ được — cùng
 * luật Pha 1 đã theo cho Dashboard/Services.
 */
const ITEMS: readonly { screen: MixEngineScreen | null; labelKey: TranslationKey }[] = [
  { screen: "dashboard", labelKey: "mixengine.sidebar.dashboard" },
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
