import type { HostRecord } from "../types";

type Props = {
  hosts: HostRecord[];
  selectedId: string | null;
  onAdd: () => void;
  onConnect: (host: HostRecord) => void;
  onEdit: (id: string) => void;
};

export function HostsPanel({
  hosts,
  selectedId,
  onAdd,
  onConnect,
  onEdit,
}: Props) {
  return (
    <section className="hosts-panel" aria-label="Saved hosts">
      <div className="section-header">
        <div>
          <h2>Hosts</h2>
          <p>{hosts.length} saved connection{hosts.length === 1 ? "" : "s"}</p>
        </div>
        <button className="primary-button compact-button" type="button" onClick={onAdd}>
          + Add Host
        </button>
      </div>
      {hosts.length === 0 ? (
        <div className="empty-hosts">
          <p>No hosts yet</p>
        </div>
      ) : (
        <div className="host-history" aria-label="Host history">
          {hosts.map((host) => (
            <article
              className={host.id === selectedId ? "host-card active" : "host-card"}
              key={host.id}
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
