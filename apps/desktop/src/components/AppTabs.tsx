import type { TerminalTab } from "../types";

type Props = {
  activeId: string | null;
  tabs: TerminalTab[];
  onActivate: (id: string | null) => void;
  onClose: (id: string) => void;
};

export function AppTabs({ activeId, tabs, onActivate, onClose }: Props) {
  return (
    <div className="app-tabs" aria-label="Open sessions">
      <button
        className={activeId === null ? "app-tab active" : "app-tab"}
        type="button"
        onClick={() => onActivate(null)}
      >
        Vaults
      </button>
      {tabs.map((tab) => (
        <div className={tab.id === activeId ? "app-tab active" : "app-tab"} key={tab.id}>
          <button type="button" onClick={() => onActivate(tab.id)}>
            {tab.host.label}
          </button>
          <button type="button" aria-label={`Close ${tab.host.label}`} onClick={() => onClose(tab.id)}>
            x
          </button>
        </div>
      ))}
      <button className="app-tab new-tab" type="button" onClick={() => onActivate(null)}>
        New Tab
      </button>
      <button className="app-tab plus-tab" type="button" onClick={() => onActivate(null)}>
        +
      </button>
    </div>
  );
}
