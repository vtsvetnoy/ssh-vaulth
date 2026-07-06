import type { HostRecord, TerminalTab } from "../types";

export const MIN_TERMINAL_TABS = 1;
export const MAX_TERMINAL_TABS = 20;

function newTabId() {
  return crypto.randomUUID();
}

export function openBlankTab(
  tabs: TerminalTab[],
  newId: () => string = newTabId,
) {
  if (tabs.length >= MAX_TERMINAL_TABS) {
    return {
      tabs,
      activeId: tabs[tabs.length - 1]?.id ?? null,
    };
  }

  const tab: TerminalTab = { id: newId() };
  return {
    tabs: [...tabs, tab],
    activeId: tab.id,
  };
}

export function openHostTab(
  tabs: TerminalTab[],
  host: HostRecord,
  activeId: string | null = null,
  newId: () => string = newTabId,
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

  if (tabs.length >= MAX_TERMINAL_TABS) {
    return {
      tabs,
      activeId: tabs[tabs.length - 1]?.id ?? null,
    };
  }

  const tab = { id: newId(), host };
  return {
    tabs: [...tabs, tab],
    activeId: tab.id,
  };
}

export function closeTab(
  tabs: TerminalTab[],
  tabId: string,
  activeId: string | null,
  newId: () => string = newTabId,
) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  const nextTabs = tabs.filter((tab) => tab.id !== tabId);

  if (nextTabs.length < MIN_TERMINAL_TABS) {
    const tab: TerminalTab = { id: newId() };
    return {
      tabs: [tab],
      activeId: tab.id,
    };
  }

  if (activeId !== tabId) {
    return {
      tabs: nextTabs,
      activeId,
    };
  }

  return {
    tabs: nextTabs,
    activeId: nextTabs[index]?.id ?? nextTabs[index - 1]?.id ?? nextTabs[0].id,
  };
}
