import { useMemo, useState } from "react";

import { SyncClient } from "./api/client";
import { HostEditor } from "./components/HostEditor";
import { HostList } from "./components/HostList";
import { KeysPanel } from "./components/KeysPanel";
import { LoginScreen } from "./components/LoginScreen";
import { TerminalWorkspace } from "./components/TerminalWorkspace";
import { UnlockScreen } from "./components/UnlockScreen";
import { decryptVault, emptyVault, encryptVault } from "./crypto/vault";
import { openHostTab } from "./terminal/tabs";
import type { EncryptedVault, HostRecord, TerminalTab, Vault } from "./types";

type Screen = "login" | "unlock" | "main";
type MainView = "hosts" | "keys";

export function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState(0);
  const [remoteVault, setRemoteVault] = useState<EncryptedVault | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [activeView, setActiveView] = useState<MainView>("hosts");
  const [editing, setEditing] = useState(false);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
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
    setSelectedId(host.id);
  }

  function openTerminal(host: HostRecord) {
    const result = openHostTab(terminalTabs, host);
    setTerminalTabs(result.tabs);
    setActiveTerminalId(result.activeId);
    setSelectedId(host.id);
    setEditing(false);
    setActiveView("hosts");
  }

  function closeTerminal(tabId: string) {
    setTerminalTabs((tabs) => {
      const index = tabs.findIndex((tab) => tab.id === tabId);
      const nextTabs = tabs.filter((tab) => tab.id !== tabId);
      setActiveTerminalId((current) => {
        if (current !== tabId) return current;
        return nextTabs[index]?.id ?? nextTabs[index - 1]?.id ?? null;
      });
      return nextTabs;
    });
  }

  function editHost(id: string) {
    setSelectedId(id);
    setEditing(true);
    setActiveView("hosts");
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
        activeView={activeView}
        hosts={vault?.hosts ?? []}
        selectedId={selectedId}
        onAdd={() => {
          setSelectedId(null);
          setEditing(true);
          setActiveView("hosts");
        }}
        onConnect={openTerminal}
        onEdit={editHost}
        onViewChange={(view) => {
          setActiveView(view);
          setEditing(false);
        }}
      />

      <section className="workspace" aria-label="Workspace">
        {activeView === "keys" ? <KeysPanel /> : null}
        {activeView === "hosts" && editing ? (
          <HostEditor initial={selected ?? undefined} onSave={saveHost} />
        ) : null}
        {activeView === "hosts" && !editing ? (
          <TerminalWorkspace
            activeId={activeTerminalId}
            tabs={terminalTabs}
            onActivate={setActiveTerminalId}
            onClose={closeTerminal}
          />
        ) : null}
      </section>
    </main>
  );
}
