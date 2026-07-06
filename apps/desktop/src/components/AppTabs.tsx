import type { TerminalTab } from "../types";

type Props = {
  activeId: string | null;
  homeMode: "vault" | "recent";
  layout: "focus" | "grid";
  tabs: TerminalTab[];
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onToggleLayout: () => void;
  onVaultToggle: () => void;
};

export function AppTabs({
  activeId,
  homeMode,
  layout,
  tabs,
  onActivate,
  onClose,
  onNewTab,
  onToggleLayout,
  onVaultToggle,
}: Props) {
  return (
    <div className="app-tabs" aria-label="Open sessions">
      <button
        className={activeId === null && homeMode === "vault" ? "app-tab active" : "app-tab"}
        type="button"
        onClick={onVaultToggle}
      >
        Vaults
      </button>
      {tabs.map((tab) => (
        <div className={tab.id === activeId ? "app-tab active" : "app-tab"} key={tab.id}>
          <button type="button" onClick={() => onActivate(tab.id)}>
            {tab.host?.label ?? "New Tab"}
          </button>
          <button
            type="button"
            aria-label={`Close ${tab.host?.label ?? "New Tab"}`}
            onClick={() => onClose(tab.id)}
          >
            x
          </button>
        </div>
      ))}
      <button
        className={activeId === null && homeMode === "recent" ? "app-tab new-tab active" : "app-tab new-tab"}
        type="button"
        onClick={onNewTab}
      >
        New Tab
      </button>
      <button className="app-tab plus-tab" type="button" onClick={onNewTab}>
        +
      </button>
      <button className="app-tab layout-tab" type="button" onClick={onToggleLayout}>
        {layout === "focus" ? "Grid" : "Focus"}
      </button>
    </div>
  );
}
