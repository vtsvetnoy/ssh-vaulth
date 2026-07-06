import { SshTerminal } from "./SshTerminal";
import type { TerminalTab } from "../types";

type Props = {
  tabs: TerminalTab[];
  activeId: string | null;
  layout: "focus" | "grid";
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
};

export function TerminalWorkspace({
  tabs,
  activeId,
  layout,
  onActivate,
  onClose,
}: Props) {
  if (tabs.length === 0) {
    return (
      <div className="empty-state">
        <p>Select a host to start a secure session.</p>
      </div>
    );
  }

  return (
    <div className={layout === "grid" ? "terminal-workspace grid" : "terminal-workspace"}>
      <div className="terminal-panels">
        {tabs.filter((tab) => tab.host).map((tab) => (
          <div
            key={tab.id}
            className={
              layout === "grid" || tab.id === activeId
                ? "terminal-panel-slot active"
                : "terminal-panel-slot"
            }
            onClick={() => onActivate(tab.id)}
          >
            {tab.host ? (
              <SshTerminal
                active={tab.id === activeId}
                host={tab.host}
                onClose={() => onClose(tab.id)}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
