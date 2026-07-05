import { invoke } from "@tauri-apps/api/core";

import type { EncryptedVault, KeyRecord, Vault } from "../types";

type PersistedVault = Omit<Vault, "keys"> & {
  keys?: KeyRecord[];
};

export function emptyVault(): Vault {
  return {
    schemaVersion: 1,
    hosts: [],
    keys: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeVault(vault: PersistedVault): Vault {
  return {
    ...vault,
    hosts: vault.hosts ?? [],
    keys: vault.keys ?? [],
  };
}

export async function encryptVault(vault: Vault, masterPassword: string) {
  return await invoke<EncryptedVault>("encrypt_vault_command", {
    vault,
    masterPassword,
  });
}

export async function decryptVault(
  encryptedVault: EncryptedVault,
  masterPassword: string,
) {
  const vault = await invoke<Vault>("decrypt_vault_command", {
    encryptedVault,
    masterPassword,
  });
  return normalizeVault(vault);
}
