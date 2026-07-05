import { afterEach, describe, expect, it, vi } from "vitest";

import { SyncClient } from "./client";
import type { EncryptedVault } from "../types";

const encryptedVault: EncryptedVault = {
  schemaVersion: 1,
  cipher: "xchacha20poly1305",
  kdf: {
    algorithm: "argon2id",
    memoryKib: 65_536,
    iterations: 3,
    parallelism: 1,
    keyLength: 32,
    salt: "AAAAAAAAAAAAAAAAAAAAAA==",
  },
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  ciphertext: "ciphertext",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SyncClient", () => {
  it("checks server health before auth", async () => {
    const fetchMock = mockFetch({ status: "ok" });
    const client = new SyncClient("https://sync.example.test");

    await expect(client.health()).resolves.toEqual({ status: "ok" });

    expect(fetchMock).toHaveBeenCalledWith("https://sync.example.test/health");
  });

  it("logs in with the expected endpoint and payload", async () => {
    const fetchMock = mockFetch({ token: "session-token" });
    const client = new SyncClient("https://sync.example.test");

    await expect(client.login("me@example.test", "secret", "mac")).resolves.toEqual({
      token: "session-token",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://sync.example.test/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "me@example.test",
        password: "secret",
        deviceName: "mac",
      }),
    });
  });

  it("downloads the vault with a bearer token", async () => {
    const fetchMock = mockFetch({ version: 0, encryptedVault: null });
    const client = new SyncClient("https://sync.example.test", "session-token");

    await expect(client.getVault()).resolves.toEqual({
      version: 0,
      encryptedVault: null,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://sync.example.test/vault", {
      headers: { authorization: "Bearer session-token" },
    });
  });

  it("turns stale vault uploads into a conflict error", async () => {
    mockFetch({ error: "vault_version_conflict" }, 409);
    const client = new SyncClient("https://sync.example.test", "session-token");

    await expect(client.putVault(0, encryptedVault)).rejects.toThrow(
      "Vault version conflict",
    );
  });
});

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}
