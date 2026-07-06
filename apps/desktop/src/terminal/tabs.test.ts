import { describe, expect, it } from "vitest";

import { closeTab, MAX_TERMINAL_TABS, openBlankTab, openHostTab } from "./tabs";
import type { HostRecord, TerminalTab } from "../types";

const host: HostRecord = {
  id: "host-1",
  label: "Office",
  hostname: "office.example.test",
  port: 22,
  username: "ubuntu",
  auth: { type: "privateKey", privateKey: "key" },
  notes: "",
  createdAt: "2026-07-05T00:00:00Z",
  updatedAt: "2026-07-05T00:00:00Z",
};

describe("openHostTab", () => {
  it("opens another terminal tab for the same saved host", () => {
    const existing: TerminalTab[] = [{ id: "tab-1", host }];

    const result = openHostTab(existing, host, null, () => "tab-2");

    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[1]).toEqual({ id: "tab-2", host });
    expect(result.activeId).toBe("tab-2");
  });

  it("opens multiple blank tabs", () => {
    const first = openBlankTab([], () => "new-1");
    const second = openBlankTab(first.tabs, () => "new-2");

    expect(second.tabs).toEqual([{ id: "new-1" }, { id: "new-2" }]);
    expect(second.activeId).toBe("new-2");
  });

  it("opens a blank tab with the default id generator", () => {
    const result = openBlankTab([]);

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].id).toEqual(expect.any(String));
    expect(result.activeId).toBe(result.tabs[0].id);
  });

  it("opens six blank tabs in a row", () => {
    let tabs: TerminalTab[] = [];
    let activeId = "";

    for (let index = 1; index <= 6; index += 1) {
      const result = openBlankTab(tabs, () => `new-${index}`);
      tabs = result.tabs;
      activeId = result.activeId;
    }

    expect(tabs).toHaveLength(6);
    expect(tabs.map((tab) => tab.id)).toEqual([
      "new-1",
      "new-2",
      "new-3",
      "new-4",
      "new-5",
      "new-6",
    ]);
    expect(activeId).toBe("new-6");
  });

  it("does not open more than twenty tabs", () => {
    let tabs: TerminalTab[] = [];
    let activeId: string | null = "";

    for (let index = 1; index <= 21; index += 1) {
      const result = openBlankTab(tabs, () => `new-${index}`);
      tabs = result.tabs;
      activeId = result.activeId;
    }

    expect(tabs).toHaveLength(MAX_TERMINAL_TABS);
    expect(tabs.at(-1)?.id).toBe("new-20");
    expect(activeId).toBe("new-20");
  });

  it("keeps at least one tab after closing the last tab", () => {
    const result = closeTab([{ id: "new-1" }], "new-1", "new-1", () => "new-2");

    expect(result.tabs).toEqual([{ id: "new-2" }]);
    expect(result.activeId).toBe("new-2");
  });

  it("turns the active blank tab into a host tab", () => {
    const existing: TerminalTab[] = [{ id: "new-1" }, { id: "new-2" }];

    const result = openHostTab(existing, host, "new-2", () => "unused");

    expect(result.tabs).toEqual([{ id: "new-1" }, { id: "new-2", host }]);
    expect(result.activeId).toBe("new-2");
  });
});
