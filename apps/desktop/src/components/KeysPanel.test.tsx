import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { KeyRecord } from "../types";
import { KeysPanel } from "./KeysPanel";

const key: KeyRecord = {
  id: "key-1",
  label: "oracle",
  privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
  notes: "",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

describe("KeysPanel", () => {
  it("offers adding keys and lists saved keys", () => {
    const html = renderToStaticMarkup(
      <KeysPanel keys={[key]} onSave={() => undefined} />,
    );

    expect(html).toContain("+ Add key");
    expect(html).toContain("oracle");
    expect(html).not.toContain("disabled");
  });
});
