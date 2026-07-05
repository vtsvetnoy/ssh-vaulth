import { FormEvent, useState } from "react";

import type { KeyRecord } from "../types";

type Props = {
  keys: KeyRecord[];
  onSave: (key: KeyRecord) => Promise<void> | void;
};

export function KeysPanel({ keys, onSave }: Props) {
  const now = new Date().toISOString();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [certificate, setCertificate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        label,
        publicKey: publicKey || undefined,
        privateKey,
        passphrase: passphrase || undefined,
        certificate: certificate || undefined,
        notes,
        createdAt: now,
        updatedAt: now,
      });
      setLabel("");
      setPublicKey("");
      setPrivateKey("");
      setPassphrase("");
      setCertificate("");
      setNotes("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Key save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel keys-panel">
      <div className="section-header">
        <div>
          <h1>Keys & Certificates</h1>
          <p>{keys.length} saved item{keys.length === 1 ? "" : "s"}</p>
        </div>
        <button
          className="primary-button compact-button"
          type="button"
          onClick={() => setAdding((value) => !value)}
        >
          {adding ? "Close" : "+ Add key"}
        </button>
      </div>
      {adding ? (
        <form className="key-form" onSubmit={submit}>
          <label>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          <label>Public key</label>
          <textarea
            className="compact-textarea"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
          <label>Private key</label>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            required
          />
          <label>Passphrase</label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <label>Certificate</label>
          <textarea
            className="compact-textarea"
            value={certificate}
            onChange={(e) => setCertificate(e.target.value)}
          />
          <label>Notes</label>
          <textarea
            className="compact-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving" : "Save key"}
          </button>
        </form>
      ) : null}
      <div className="key-list" aria-label="Saved keys">
        {keys.length === 0 ? <p>No keys yet</p> : null}
        {keys.map((key) => (
          <article className="key-row" key={key.id}>
            <strong>{key.label}</strong>
            <span>
              {[
                key.publicKey ? "public key" : null,
                "private key",
                key.certificate ? "certificate" : null,
              ]
                .filter(Boolean)
                .join(" + ")}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
