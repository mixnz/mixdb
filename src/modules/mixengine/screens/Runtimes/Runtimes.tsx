import { useState } from "react";

import { Tab, TabStrip, tabKeyDown } from "../../../../components/TabStrip";
import { useTranslation } from "../../../../i18n";
import Languages from "./Languages";
import Packages from "./Packages";
import styles from "./Runtimes.module.css";

type TabKey = "languages" | "packages";

/**
 * Một sidebar item, hai tab con — không hai mục sidebar (D5). `runtime.*` và `package.*` cùng hình
 * dạng RPC và cùng hình dạng job, khác đúng namespace gọi và đúng khả năng `force`.
 */
export default function Runtimes() {
  const [tab, setTab] = useState<TabKey>("languages");
  const { t } = useTranslation();

  const tabs: { key: TabKey; label: string }[] = [
    { key: "languages", label: t("mixengine.runtimes.tabLanguages") },
    { key: "packages", label: t("mixengine.runtimes.tabPackages") },
  ];

  return (
    <div className={styles.runtimes}>
      <TabStrip size="small" role="tablist">
        {tabs.map((item) => {
          const active = item.key === tab;
          const pick = () => setTab(item.key);
          return (
            <Tab
              key={item.key}
              active={active}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={pick}
              onKeyDown={tabKeyDown(pick)}
            >
              {item.label}
            </Tab>
          );
        })}
      </TabStrip>
      {tab === "languages" ? <Languages /> : <Packages />}
    </div>
  );
}
