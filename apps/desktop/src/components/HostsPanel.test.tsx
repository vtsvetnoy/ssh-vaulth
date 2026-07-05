import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { HostRecord } from "../types";
import { HostsPanel } from "./HostsPanel";

const host: HostRecord = {
  id: "host-1",
  label: "office",
  hostname: "office.example.test",
  port: 22,
  username: "deploy",
  auth: { type: "password", password: "secret" },
  notes: "",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

describe("HostsPanel", () => {
  it("shows saved hosts in the main hosts view", () => {
    const html = renderToStaticMarkup(
      <HostsPanel
        hosts={[host]}
        selectedId="host-1"
        onAdd={() => undefined}
        onSelect={() => undefined}
        onConnect={() => undefined}
        onEdit={() => undefined}
      />,
    );

    expect(html).toContain("office");
    expect(html).toContain("Host Details");
    expect(html).toContain("office.example.test");
    expect(html).toContain("SSH on <span>22</span> port");
    expect(html).toContain("Connect");
  });
});
