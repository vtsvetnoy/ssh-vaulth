import type { HostRecord } from "../types";

type Props = {
  hosts: HostRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
};

export function HostList({ hosts, selectedId, onSelect, onAdd }: Props) {
  return (
    <aside className="sidebar" aria-label="Hosts">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          SV
        </div>
        <div>
          <h1>SSH Vault</h1>
          <p>Personal SSH client</p>
        </div>
      </div>
      <button className="add-host-button" type="button" onClick={onAdd}>
        <span aria-hidden="true">+</span>
        Add Host
      </button>
      <div className="host-list" aria-label="Saved hosts">
        {hosts.length === 0 ? <p>No hosts yet</p> : null}
        {hosts.map((host) => (
          <button
            key={host.id}
            className={host.id === selectedId ? "host-row active" : "host-row"}
            onClick={() => onSelect(host.id)}
          >
            <strong>{host.label}</strong>
            <span>
              {host.username}@{host.hostname}:{host.port}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
