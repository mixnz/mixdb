import { useState } from "react";

import { useTranslation } from "../../../../i18n";
import Languages from "./Languages";
import Packages from "./Packages";
import styles from "./Runtimes.module.css";

type Tab = "languages" | "packages";

/**
 * Một sidebar item, hai tab con — không hai mục sidebar (D5). `runtime.*` và `package.*` cùng hình
 * dạng RPC và cùng hình dạng job, khác đúng namespace gọi và đúng khả năng `force`.
 */
export default function Runtimes() {
  const [tab, setTab] = useState<Tab>("languages");
  const { t } = useTranslation();

  return (
    <div className={styles.runtimes}>
      <div className={styles.tabs}>
        <button
          className={tab === "languages" ? styles.activeTab : styles.tab}
          onClick={() => setTab("languages")}
        >
          {t("mixengine.runtimes.tabLanguages")}
        </button>
        <button
          className={tab === "packages" ? styles.activeTab : styles.tab}
          onClick={() => setTab("packages")}
        >
          {t("mixengine.runtimes.tabPackages")}
        </button>
      </div>
      {tab === "languages" ? <Languages /> : <Packages />}
    </div>
  );
}
