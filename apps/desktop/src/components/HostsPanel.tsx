import type { KeyboardEvent } from "react";

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
  function connectWithKeyboard(event: KeyboardEvent<HTMLElement>, host: HostRecord) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onConnect(host);
  }

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
              onClick={() => onConnect(host)}
              onKeyDown={(event) => connectWithKeyboard(event, host)}
              role="button"
              tabIndex={0}
            >
              <div className="host-card-content">
                <strong>{host.label}</strong>
                <span>
                  {host.username}@{host.hostname}:{host.port}
                </span>
              </div>
              <button
                className="host-edit-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(host.id);
                }}
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
