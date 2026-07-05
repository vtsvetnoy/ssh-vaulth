type Props = {
  activeView: "hosts" | "keys";
  expanded: boolean;
  onViewChange: (view: "hosts" | "keys") => void;
};

export function HostList({
  activeView,
  expanded,
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
      {expanded ? (
        <>
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
        </>
      ) : null}
    </aside>
  );
}
