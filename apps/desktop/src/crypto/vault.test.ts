import { describe, expect, it } from "vitest";

import { normalizeVault } from "./vault";

describe("normalizeVault", () => {
  it("keeps old vault files usable when keys are missing", () => {
    const vault = normalizeVault({
      schemaVersion: 1,
      hosts: [],
      updatedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(vault.keys).toEqual([]);
  });
});
