import { useMemo, useState } from "react";

import { SyncClient } from "./api/client";
import { HostEditor } from "./components/HostEditor";
import { HostList } from "./components/HostList";
import { LoginScreen } from "./components/LoginScreen";
import { SshTerminal } from "./components/SshTerminal";
import { UnlockScreen } from "./components/UnlockScreen";
import { decryptVault, emptyVault, encryptVault } from "./crypto/vault";
import type { EncryptedVault, HostRecord, Vault } from "./types";

type Screen = "login" | "unlock" | "main";

export function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState(0);
  const [remoteVault, setRemoteVault] = useState<EncryptedVault | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [terminalHost, setTerminalHost] = useState<HostRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const client = useMemo(() => new SyncClient(serverUrl, token), [serverUrl, token]);

  async function authenticate(
    mode: "login" | "register",
    email: string,
    password: string,
    nextServerUrl: string,
  ) {
    const nextClient = new SyncClient(nextServerUrl);
    const auth =
      mode === "login"
        ? await nextClient.login(email, password, navigator.userAgent)
        : await nextClient.register(email, password, navigator.userAgent);
    nextClient.setToken(auth.token);
    const vaultResponse = await nextClient.getVault();
    setServerUrl(nextServerUrl);
    setToken(auth.token);
    setVersion(vaultResponse.version);
    setRemoteVault(vaultResponse.encryptedVault);
    setScreen("unlock");
  }

  async function unlock(nextMasterPassword: string) {
    const opened = remoteVault
      ? await decryptVault(remoteVault, nextMasterPassword)
      : emptyVault();
    setVault(opened);
    setMasterPassword(nextMasterPassword);
    setScreen("main");
  }

  async function saveHost(host: HostRecord) {
    if (!vault) return;
    const hosts = vault.hosts.some((item) => item.id === host.id)
      ? vault.hosts.map((item) => (item.id === host.id ? host : item))
      : [...vault.hosts, host];
    const nextVault = { ...vault, hosts, updatedAt: new Date().toISOString() };
    const encrypted = await encryptVault(nextVault, masterPassword);
    const result = await client.putVault(version, encrypted);
    setVault(nextVault);
    setRemoteVault(encrypted);
    setVersion(result.version);
    setEditing(false);
    setTerminalHost(null);
    setSelectedId(host.id);
  }

  if (screen === "login") {
    return (
      <main className="centered">
        <LoginScreen onSubmit={authenticate} />
      </main>
    );
  }

  if (screen === "unlock") {
    return (
      <main className="centered">
        <UnlockScreen hasRemoteVault={Boolean(remoteVault)} onUnlock={unlock} />
      </main>
    );
  }

  const selected = vault?.hosts.find((host) => host.id === selectedId);

  return (
    <main className="app-shell">
      <HostList
        hosts={vault?.hosts ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={() => {
          setSelectedId(null);
          setEditing(true);
        }}
      />

      <section className="workspace" aria-label="Workspace">
        {terminalHost ? (
          <SshTerminal host={terminalHost} onClose={() => setTerminalHost(null)} />
        ) : null}
        {!terminalHost && editing ? (
          <HostEditor initial={selected ?? undefined} onSave={saveHost} />
        ) : null}
        {!terminalHost && !editing && selected ? (
          <div className="panel">
            <h1>{selected.label}</h1>
            <p>
              {selected.username}@{selected.hostname}:{selected.port}
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => setTerminalHost(selected)}
            >
              Connect
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          </div>
        ) : null}
        {!terminalHost && !editing && !selected ? (
          <div className="empty-state">
            <p>Select or add a host to start a secure session.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
