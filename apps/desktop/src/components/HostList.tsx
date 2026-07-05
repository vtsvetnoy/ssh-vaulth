import type { HostRecord } from "../types";

type Props = {
  hosts: HostRecord[];
  activeView: "hosts" | "keys";
  selectedId: string | null;
  onAdd: () => void;
  onConnect: (host: HostRecord) => void;
  onEdit: (id: string) => void;
  onViewChange: (view: "hosts" | "keys") => void;
};

export function HostList({
  hosts,
  activeView,
  selectedId,
  onAdd,
  onConnect,
  onEdit,
  onViewChange,
}: Props) {
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
      <nav className="sidebar-nav" aria-label="Vault sections">
        <button
          className={activeView === "hosts" ? "nav-item active" : "nav-item"}
          type="button"
          onClick={() => onViewChange("hosts")}
        >
          Hosts
        </button>
        <button
          className={activeView === "keys" ? "nav-item active" : "nav-item"}
          type="button"
          onClick={() => onViewChange("keys")}
        >
          Keys & Certificates
        </button>
      </nav>
      <button className="add-host-button" type="button" onClick={onAdd}>
        <span aria-hidden="true">+</span>
        Add Host
      </button>
      <div className="host-list" aria-label="Saved hosts">
        {hosts.length === 0 ? <p>No hosts yet</p> : null}
        {hosts.map((host) => (
          <div
            key={host.id}
            className={host.id === selectedId ? "host-row active" : "host-row"}
          >
            <button type="button" onClick={() => onConnect(host)}>
              <strong>{host.label}</strong>
              <span>
                {host.username}@{host.hostname}:{host.port}
              </span>
            </button>
            <button
              className="host-edit-button"
              type="button"
              onClick={() => onEdit(host.id)}
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
