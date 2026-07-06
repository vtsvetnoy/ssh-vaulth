import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tauri capabilities", () => {
  it("allows frontend SSH terminals to listen for backend events", () => {
    const capabilityPath = resolve(
      __dirname,
      "../src-tauri/capabilities/default.json",
    );
    const capability = JSON.parse(readFileSync(capabilityPath, "utf8")) as {
      windows: string[];
      permissions: string[];
    };

    expect(capability.windows).toContain("main");
    expect(capability.permissions).toContain("core:event:default");
  });
});
