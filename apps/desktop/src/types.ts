export type HostAuth =
  | { type: "password"; password: string }
  | { type: "privateKey"; privateKey: string; privateKeyPassphrase?: string };

export type HostRecord = {
  id: string;
  label: string;
  hostname: string;
  port: number;
  username: string;
  auth: HostAuth;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Vault = {
  schemaVersion: number;
  hosts: HostRecord[];
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
