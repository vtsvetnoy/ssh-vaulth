import type { HostRecord } from "../types";

type Props = {
  hosts: HostRecord[];
  selectedId: string | null;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onConnect: (host: HostRecord) => void;
  onEdit: (id: string) => void;
};

export function HostsPanel({
  hosts,
  selectedId,
  onAdd,
  onSelect,
  onConnect,
  onEdit,
}: Props) {
  const selected = hosts.find((host) => host.id === selectedId) ?? hosts[0] ?? null;
  const groups = Array.from(
    hosts.reduce((items, host) => {
      const group = host.group?.trim() || "Personal";
      items.set(group, (items.get(group) ?? 0) + 1);
      return items;
    }, new Map<string, number>()),
  );

  return (
    <section className="vault-layout" aria-label="Vault hosts">
      <div className="vault-main">
        <div className="vault-search-row">
          <input placeholder="Find a host or ssh user@hostname..." />
          <button
            className="primary-button compact-button"
            disabled={!selected}
            type="button"
            onClick={() => selected && onConnect(selected)}
          >
            Connect
          </button>
        </div>
        <div className="vault-toolbar">
          <button className="secondary-button compact-button" type="button" onClick={onAdd}>
            + New host
          </button>
          <span>Terminal</span>
        </div>
        <div className="vault-scroll">
          <h2>Groups</h2>
          <div className="group-grid">
            {groups.length === 0 ? <p>No groups yet</p> : null}
            {groups.map(([group, count]) => (
              <div className="group-card" key={group}>
                <strong>{group}</strong>
                <span>{count} Host{count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
          <h2>Hosts</h2>
          {hosts.length === 0 ? (
            <div className="empty-hosts">
              <p>No hosts yet</p>
            </div>
          ) : (
            <div className="vault-host-grid" aria-label="Saved hosts">
              {hosts.map((host) => (
                <button
                  className={host.id === selected?.id ? "vault-host-card active" : "vault-host-card"}
                  key={host.id}
                  type="button"
                  onClick={() => onSelect(host.id)}
                >
                  <span className="host-icon">ssh</span>
                  <span>
                    <strong>{host.label}</strong>
                    <small>
                      ssh, {host.username || "user"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <aside className="host-details" aria-label="Host details">
        <div className="details-header">
          <div>
            <h2>Host Details</h2>
            <p>{selected?.group || "Personal vault"}</p>
          </div>
          {selected ? (
            <button className="host-edit-button" type="button" onClick={() => onEdit(selected.id)}>
              Edit
            </button>
          ) : null}
        </div>
        {selected ? (
          <>
            <section className="details-card">
              <h3>Address</h3>
              <div className="details-address">
                <span className="host-icon">ssh</span>
                <span>{selected.hostname}</span>
              </div>
            </section>
            <section className="details-card">
              <h3>General</h3>
              <div className="detail-field">{selected.label}</div>
              <div className="detail-field">{selected.group || "Personal"}</div>
            </section>
            <section className="details-card">
              <h3>SSH on <span>{selected.port}</span> port</h3>
              <div className="detail-field">{selected.username}</div>
              <div className="detail-field">
                {selected.auth.type === "password"
                  ? "Password"
                  : selected.auth.type === "privateKey"
                    ? "Private key"
                    : "Password + private key"}
              </div>
            </section>
            <button className="connect-button" type="button" onClick={() => onConnect(selected)}>
              Connect
            </button>
          </>
        ) : (
          <div className="details-card">
            <p>Select a host to view settings.</p>
          </div>
        )}
      </aside>
    </section>
  );
}
