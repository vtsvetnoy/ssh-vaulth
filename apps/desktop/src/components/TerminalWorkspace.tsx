import { SshTerminal } from "./SshTerminal";
import type { TerminalTab } from "../types";

type Props = {
  tabs: TerminalTab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
};

export function TerminalWorkspace({ tabs, activeId, onActivate, onClose }: Props) {
  if (tabs.length === 0) {
    return (
      <div className="empty-state">
        <p>Select a host to start a secure session.</p>
      </div>
    );
  }

  return (
    <div className="terminal-workspace">
      <div className="terminal-panels">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={
              tab.id === activeId ? "terminal-panel-slot active" : "terminal-panel-slot"
            }
          >
            <SshTerminal
              active={tab.id === activeId}
              host={tab.host}
              onClose={() => onClose(tab.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
