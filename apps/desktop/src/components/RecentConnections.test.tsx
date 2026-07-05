import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { HostRecord } from "../types";
import { RecentConnections } from "./RecentConnections";

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

describe("RecentConnections", () => {
  it("shows a recent host picker for new tab", () => {
    const html = renderToStaticMarkup(
      <RecentConnections
        hosts={[host]}
        onConnect={() => undefined}
        onOpenVault={() => undefined}
      />,
    );

    expect(html).toContain("Search hosts or tabs");
    expect(html).toContain("Recent connections");
    expect(html).toContain("office");
    expect(html).toContain("Open vault");
  });
});
