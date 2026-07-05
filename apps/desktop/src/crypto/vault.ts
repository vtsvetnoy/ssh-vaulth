import { invoke } from "@tauri-apps/api/core";

import type { EncryptedVault, Vault } from "../types";

export function emptyVault(): Vault {
  return {
    schemaVersion: 1,
    hosts: [],
    updatedAt: new Date().toISOString(),
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
  return await invoke<Vault>("decrypt_vault_command", {
    encryptedVault,
    masterPassword,
  });
}
