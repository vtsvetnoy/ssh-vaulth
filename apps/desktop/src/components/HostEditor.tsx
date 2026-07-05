import { FormEvent, useState } from "react";

import type { HostRecord } from "../types";
import { buildHostAuth } from "./hostAuth";

type Props = {
  initial?: HostRecord;
  onSave: (host: HostRecord) => Promise<void> | void;
};

export function HostEditor({ initial, onSave }: Props) {
  const now = new Date().toISOString();
  const initialUsesPassword =
    initial?.auth.type === "password" || initial?.auth.type === "passwordAndPrivateKey";
  const initialUsesPrivateKey =
    initial?.auth.type === "privateKey" || initial?.auth.type === "passwordAndPrivateKey";
  const initialPassword =
    initial?.auth.type === "password" || initial?.auth.type === "passwordAndPrivateKey"
      ? initial.auth.password
      : "";
  const initialPrivateKey =
    initial?.auth.type === "privateKey" || initial?.auth.type === "passwordAndPrivateKey"
      ? initial.auth.privateKey
      : "";
  const initialPrivateKeyPassphrase =
    initial?.auth.type === "privateKey" || initial?.auth.type === "passwordAndPrivateKey"
      ? (initial.auth.privateKeyPassphrase ?? "")
      : "";
  const [label, setLabel] = useState(initial?.label ?? "");
  const [hostname, setHostname] = useState(initial?.hostname ?? "");
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [usePassword, setUsePassword] = useState(initial ? initialUsesPassword : true);
  const [usePrivateKey, setUsePrivateKey] = useState(initial ? initialUsesPrivateKey : false);
  const [password, setPassword] = useState(initialPassword);
  const [privateKey, setPrivateKey] = useState(initialPrivateKey);
  const [privateKeyPassphrase, setPrivateKeyPassphrase] = useState(
    initialPrivateKeyPassphrase,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        label,
        hostname,
        port,
        username,
        auth: buildHostAuth({
          usePassword,
          usePrivateKey,
          password,
          privateKey,
          privateKeyPassphrase,
        }),
        notes: initial?.notes ?? "",
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Host save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel editor" onSubmit={submit}>
      <h2>{initial ? "Edit host" : "Add host"}</h2>
      <label>Label</label>
      <input value={label} onChange={(e) => setLabel(e.target.value)} required />
      <label>Hostname</label>
      <input
        value={hostname}
        onChange={(e) => setHostname(e.target.value)}
        required
      />
      <label>Port</label>
      <input
        type="number"
        min={1}
        max={65535}
        value={port}
        onChange={(e) => setPort(Number(e.target.value))}
      />
      <label>Username</label>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <fieldset className="auth-methods">
        <legend>Auth methods</legend>
        <label className="auth-method">
          <input
            type="checkbox"
            checked={usePassword}
            onChange={(e) => setUsePassword(e.target.checked || !usePrivateKey)}
          />
          <span>Password</span>
        </label>
        <label className="auth-method">
          <input
            type="checkbox"
            checked={usePrivateKey}
            onChange={(e) => setUsePrivateKey(e.target.checked || !usePassword)}
          />
          <span>Private key</span>
        </label>
      </fieldset>
      {usePassword ? (
        <>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      ) : null}
      {usePrivateKey ? (
        <>
          <label>Private key</label>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
          />
          <label>Key passphrase</label>
          <input
            type="password"
            value={privateKeyPassphrase}
            onChange={(e) => setPrivateKeyPassphrase(e.target.value)}
          />
        </>
      ) : null}
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "Saving" : "Save"}
      </button>
    </form>
  );
}
