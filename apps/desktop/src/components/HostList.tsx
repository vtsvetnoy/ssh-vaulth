type Props = {
  activeView: "hosts" | "keys";
  onAdd: () => void;
  onViewChange: (view: "hosts" | "keys") => void;
};

export function HostList({
  activeView,
  onAdd,
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
    </aside>
  );
}
