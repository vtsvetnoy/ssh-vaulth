import type { HostAuth } from "../types";

type BuildHostAuthInput = {
  usePassword: boolean;
  usePrivateKey: boolean;
  password: string;
  privateKey: string;
  privateKeyPassphrase: string;
};

export function buildHostAuth(input: BuildHostAuthInput): HostAuth {
  if (input.usePassword && input.usePrivateKey) {
    return {
      type: "passwordAndPrivateKey",
      password: input.password,
      privateKey: input.privateKey,
      privateKeyPassphrase: input.privateKeyPassphrase || undefined,
    };
  }

  if (input.usePrivateKey) {
    return {
      type: "privateKey",
      privateKey: input.privateKey,
      privateKeyPassphrase: input.privateKeyPassphrase || undefined,
    };
  }

  if (input.usePassword) {
    return { type: "password", password: input.password };
  }

  return { type: "password", password: input.password };
}
