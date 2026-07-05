import { useMemo, useState } from "react";

import { SyncClient } from "./api/client";
import { AppTabs } from "./components/AppTabs";
import { HostEditor } from "./components/HostEditor";
import { HostList } from "./components/HostList";
import { HostsPanel } from "./components/HostsPanel";
import { KeysPanel } from "./components/KeysPanel";
import { LoginScreen } from "./components/LoginScreen";
import { RecentConnections } from "./components/RecentConnections";
import { TerminalWorkspace } from "./components/TerminalWorkspace";
import { UnlockScreen } from "./components/UnlockScreen";
import { decryptVault, emptyVault, encryptVault } from "./crypto/vault";
import { openBlankTab, openHostTab } from "./terminal/tabs";
import type { EncryptedVault, HostRecord, KeyRecord, TerminalTab, Vault } from "./types";

type Screen = "login" | "unlock" | "main";
type MainView = "hosts" | "keys";
type HomeMode = "vault" | "recent";

export function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState(0);
  const [remoteVault, setRemoteVault] = useState<EncryptedVault | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [activeView, setActiveView] = useState<MainView>("hosts");
  const [homeMode, setHomeMode] = useState<HomeMode>("vault");
  const [vaultExpanded, setVaultExpanded] = useState(true);
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

  async function saveKey(key: KeyRecord) {
    if (!vault) return;
    const nextVault = {
      ...vault,
      keys: [...(vault.keys ?? []), key],
      updatedAt: new Date().toISOString(),
    };
    const encrypted = await encryptVault(nextVault, masterPassword);
    const result = await client.putVault(version, encrypted);
    setVault(nextVault);
    setRemoteVault(encrypted);
    setVersion(result.version);
  }

  function openTerminal(host: HostRecord) {
    const result = openHostTab(terminalTabs, host, activeTerminalId);
    setTerminalTabs(result.tabs);
    setActiveTerminalId(result.activeId);
    setSelectedId(host.id);
    setEditing(false);
    setActiveView("hosts");
    setHomeMode("vault");
  }

  function openNewTab() {
    const result = openBlankTab(terminalTabs);
    setTerminalTabs(result.tabs);
    setActiveTerminalId(result.activeId);
    setEditing(false);
    setHomeMode("recent");
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
  const activeTab = terminalTabs.find((tab) => tab.id === activeTerminalId) ?? null;

  return (
    <main className="app-shell">
      <HostList
        activeView={activeView}
        expanded={vaultExpanded}
        onViewChange={(view) => {
          setActiveView(view);
          setEditing(false);
          setHomeMode("vault");
          setActiveTerminalId(null);
        }}
      />

      <section className="workspace" aria-label="Workspace">
        <AppTabs
          activeId={activeTerminalId}
          homeMode={homeMode}
          tabs={terminalTabs}
          onActivate={(id) => {
            setActiveTerminalId(id);
          }}
          onNewTab={openNewTab}
          onVaultToggle={() => {
            setActiveTerminalId(null);
            setEditing(false);
            setActiveView("hosts");
            setHomeMode("vault");
            setVaultExpanded((expanded) => !expanded);
          }}
          onClose={closeTerminal}
        />
        <div className="workspace-body">
          {activeTab?.host ? (
            <TerminalWorkspace
              activeId={activeTerminalId}
              tabs={terminalTabs}
              onActivate={setActiveTerminalId}
              onClose={closeTerminal}
            />
          ) : null}
          {activeTerminalId && !activeTab?.host ? (
            <RecentConnections
              hosts={vault?.hosts ?? []}
              onConnect={openTerminal}
              onOpenVault={() => {
                setActiveTerminalId(null);
                setHomeMode("vault");
                setActiveView("hosts");
                setVaultExpanded(true);
              }}
            />
          ) : null}
          {!activeTerminalId && homeMode === "recent" ? (
            <RecentConnections
              hosts={vault?.hosts ?? []}
              onConnect={openTerminal}
              onOpenVault={() => {
                setHomeMode("vault");
                setActiveView("hosts");
                setVaultExpanded(true);
              }}
            />
          ) : null}
          {!activeTerminalId && homeMode === "vault" && activeView === "keys" ? (
            <KeysPanel keys={vault?.keys ?? []} onSave={saveKey} />
          ) : null}
          {!activeTerminalId && homeMode === "vault" && activeView === "hosts" && editing ? (
            <HostEditor initial={selected ?? undefined} onSave={saveHost} />
          ) : null}
          {!activeTerminalId && homeMode === "vault" && activeView === "hosts" && !editing ? (
            <HostsPanel
              hosts={vault?.hosts ?? []}
              selectedId={selectedId}
              onAdd={() => {
                setSelectedId(null);
                setEditing(true);
              }}
              onSelect={setSelectedId}
              onConnect={openTerminal}
              onEdit={editHost}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
