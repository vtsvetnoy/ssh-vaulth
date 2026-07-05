import type { HostRecord, TerminalTab } from "../types";

export function openBlankTab(
  tabs: TerminalTab[],
  newId: () => string = crypto.randomUUID,
) {
  const tab = { id: newId() };
  return {
    tabs: [...tabs, tab],
    activeId: tab.id,
  };
}

export function openHostTab(
  tabs: TerminalTab[],
  host: HostRecord,
  activeId: string | null = null,
  newId: () => string = crypto.randomUUID,
) {
  if (activeId) {
    const activeTab = tabs.find((tab) => tab.id === activeId);
    if (activeTab && !activeTab.host) {
      return {
        tabs: tabs.map((tab) => (tab.id === activeId ? { ...tab, host } : tab)),
        activeId,
      };
    }
  }

  const tab = { id: newId(), host };
  return {
    tabs: [...tabs, tab],
    activeId: tab.id,
  };
}
