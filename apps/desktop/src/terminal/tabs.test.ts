import { describe, expect, it } from "vitest";

import { openHostTab } from "./tabs";
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

    const result = openHostTab(existing, host, () => "tab-2");

    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[1]).toEqual({ id: "tab-2", host });
    expect(result.activeId).toBe("tab-2");
  });
});
