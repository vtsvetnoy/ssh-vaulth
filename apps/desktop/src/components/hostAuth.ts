import type { HostAuth } from "../types";

export type HostAuthType = HostAuth["type"];

type BuildHostAuthInput = {
  authType: HostAuthType;
  password: string;
  privateKey: string;
  privateKeyPassphrase: string;
};

export function buildHostAuth(input: BuildHostAuthInput): HostAuth {
  if (input.authType === "password") {
    return { type: "password", password: input.password };
  }

  if (input.authType === "privateKey") {
    return {
      type: "privateKey",
      privateKey: input.privateKey,
      privateKeyPassphrase: input.privateKeyPassphrase || undefined,
    };
  }

  return {
    type: "passwordAndPrivateKey",
    password: input.password,
    privateKey: input.privateKey,
    privateKeyPassphrase: input.privateKeyPassphrase || undefined,
  };
}
