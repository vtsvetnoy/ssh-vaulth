export type HostAuth =
  | { type: "password"; password: string }
  | { type: "privateKey"; privateKey: string; privateKeyPassphrase?: string }
  | {
      type: "passwordAndPrivateKey";
      password: string;
      privateKey: string;
      privateKeyPassphrase?: string;
    };

export type HostRecord = {
  id: string;
  label: string;
  group?: string;
  hostname: string;
  port: number;
  username: string;
  auth: HostAuth;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type KeyRecord = {
  id: string;
  label: string;
  publicKey?: string;
  privateKey: string;
  passphrase?: string;
  certificate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TerminalTab = {
  id: string;
  host?: HostRecord;
};

export type Vault = {
  schemaVersion: number;
  hosts: HostRecord[];
  keys: KeyRecord[];
  updatedAt: string;
};

export type EncryptedVault = {
  schemaVersion: number;
  cipher: string;
  kdf: {
    algorithm: string;
    memoryKib: number;
    iterations: number;
    parallelism: number;
    keyLength: number;
    salt: string;
  };
  nonce: string;
  ciphertext: string;
};
