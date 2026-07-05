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
        onConnect={() => undefined}
        onEdit={() => undefined}
      />,
    );

    expect(html).toContain("office");
    expect(html).toContain("deploy@office.example.test:22");
    expect(html).toContain("1 saved connection");
    expect(html).toContain("role=\"button\"");
    expect(html).toContain("tabindex=\"0\"");
  });
});
