import type { HostRecord } from "../types";

type Props = {
  hosts: HostRecord[];
  onConnect: (host: HostRecord) => void;
  onOpenVault: () => void;
};

export function RecentConnections({ hosts, onConnect, onOpenVault }: Props) {
  return (
    <section className="recent-screen" aria-label="Recent connections">
      <div className="recent-search">
        <input placeholder="Search hosts or tabs" />
      </div>
      <div className="recent-list">
        <div className="recent-header">
          <h2>Recent connections</h2>
          <button className="secondary-button compact-button" type="button" onClick={onOpenVault}>
            Open vault
          </button>
        </div>
        {hosts.length === 0 ? <p>No recent connections yet</p> : null}
        {hosts.map((host) => (
          <button className="recent-row" key={host.id} type="button" onClick={() => onConnect(host)}>
            <span className="host-icon">ssh</span>
            <strong>{host.label}</strong>
            <span>{host.group || "Personal"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
