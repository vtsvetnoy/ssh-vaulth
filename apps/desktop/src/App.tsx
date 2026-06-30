export function App() {
  return (
    <main className="app-shell">
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

        <button className="add-host-button" type="button">
          <span aria-hidden="true">+</span>
          Add Host
        </button>

        <div className="host-list" aria-label="Saved hosts">
          <p>No hosts yet</p>
        </div>
      </aside>

      <section className="workspace" aria-label="Workspace">
        <div className="empty-state">
          <p>Select or add a host to start a secure session.</p>
        </div>
      </section>
    </main>
  );
}
