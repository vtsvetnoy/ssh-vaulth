import { FormEvent, useState } from "react";

import type { HostRecord } from "../types";
import { buildHostAuth, type HostAuthType } from "./hostAuth";

type Props = {
  initial?: HostRecord;
  onSave: (host: HostRecord) => void;
};

export function HostEditor({ initial, onSave }: Props) {
  const now = new Date().toISOString();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [hostname, setHostname] = useState(initial?.hostname ?? "");
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [authType, setAuthType] = useState<HostAuthType>(initial?.auth.type ?? "password");
  const [password, setPassword] = useState(
    initial?.auth.type === "password" || initial?.auth.type === "passwordAndPrivateKey"
      ? initial.auth.password
      : "",
  );
  const [privateKey, setPrivateKey] = useState(
    initial?.auth.type === "privateKey" || initial?.auth.type === "passwordAndPrivateKey"
      ? initial.auth.privateKey
      : "",
  );
  const [privateKeyPassphrase, setPrivateKeyPassphrase] = useState(
    initial?.auth.type === "privateKey" || initial?.auth.type === "passwordAndPrivateKey"
      ? (initial.auth.privateKeyPassphrase ?? "")
      : "",
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      label,
      hostname,
      port,
      username,
      auth: buildHostAuth({
        authType,
        password,
        privateKey,
        privateKeyPassphrase,
      }),
      notes: initial?.notes ?? "",
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
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
      <label>Auth</label>
      <select
        value={authType}
        onChange={(e) => setAuthType(e.target.value as HostAuthType)}
      >
        <option value="password">Password</option>
        <option value="privateKey">Private key</option>
        <option value="passwordAndPrivateKey">Password + private key</option>
      </select>
      {authType === "password" || authType === "passwordAndPrivateKey" ? (
        <>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      ) : null}
      {authType === "privateKey" || authType === "passwordAndPrivateKey" ? (
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
      <button className="primary-button" type="submit">
        Save
      </button>
    </form>
  );
}
