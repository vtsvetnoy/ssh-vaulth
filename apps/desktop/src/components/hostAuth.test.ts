import { describe, expect, it } from "vitest";

import { buildHostAuth } from "./hostAuth";

describe("buildHostAuth", () => {
  it("keeps both password and private key credentials", () => {
    expect(
      buildHostAuth({
        authType: "passwordAndPrivateKey",
        password: "server-password",
        privateKey: "-----BEGIN PRIVATE KEY-----",
        privateKeyPassphrase: "key-passphrase",
      }),
    ).toEqual({
      type: "passwordAndPrivateKey",
      password: "server-password",
      privateKey: "-----BEGIN PRIVATE KEY-----",
      privateKeyPassphrase: "key-passphrase",
    });
  });
});
