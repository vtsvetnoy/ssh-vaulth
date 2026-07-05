import type { EncryptedVault } from "../types";

export class SyncClient {
  constructor(
    private readonly baseUrl: string,
    private token: string | null = null,
  ) {}

  setToken(token: string) {
    this.token = token;
  }

  async health() {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error("Sync API unavailable");
    return (await res.json()) as { status: "ok" };
  }

  async login(email: string, password: string, deviceName: string) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, deviceName }),
    });
    if (!res.ok) throw new Error("Login failed");
    return (await res.json()) as { token: string };
  }

  async register(email: string, password: string, deviceName: string) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, deviceName }),
    });
    if (!res.ok) throw new Error("Register failed");
    return (await res.json()) as { token: string };
  }

  async getVault() {
    const res = await fetch(`${this.baseUrl}/vault`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error("Vault download failed");
    return (await res.json()) as {
      version: number;
      encryptedVault: EncryptedVault | null;
    };
  }

  async putVault(expectedVersion: number, encryptedVault: EncryptedVault) {
    const res = await fetch(`${this.baseUrl}/vault`, {
      method: "PUT",
      headers: { ...this.authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion, encryptedVault }),
    });
    if (res.status === 409) throw new Error("Vault version conflict");
    if (!res.ok) throw new Error("Vault upload failed");
    return (await res.json()) as { version: number };
  }

  private authHeaders() {
    if (!this.token) throw new Error("Missing auth token");
    return { authorization: `Bearer ${this.token}` };
  }
}
