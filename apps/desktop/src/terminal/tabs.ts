import type { HostRecord, TerminalTab } from "../types";

export function openHostTab(
  tabs: TerminalTab[],
  host: HostRecord,
  newId: () => string = crypto.randomUUID,
) {
  const tab = { id: newId(), host };
  return {
    tabs: [...tabs, tab],
    activeId: tab.id,
  };
}
