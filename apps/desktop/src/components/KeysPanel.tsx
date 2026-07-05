export function KeysPanel() {
  return (
    <div className="panel keys-panel">
      <h1>Keys & Certificates</h1>
      <p className="panel-note">
        This vault section will store reusable SSH private keys, passphrases, and
        certificates so hosts can reference them without pasting the same key again.
      </p>
      <button className="secondary-button" type="button" disabled>
        Add key
      </button>
    </div>
  );
}
