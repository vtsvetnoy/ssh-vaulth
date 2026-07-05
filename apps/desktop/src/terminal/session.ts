import { invoke } from "@tauri-apps/api/core";

import type { HostRecord } from "../types";

export type SshOutputEvent = {
  sessionId: string;
  data: string;
};

export type SshExitEvent = {
  sessionId: string;
};

export async function startSshSession(host: HostRecord) {
  return await invoke<string>("start_ssh_session", {
    host: {
      hostname: host.hostname,
      port: host.port,
      username: host.username,
    },
  });
}

export async function writeSshSession(sessionId: string, data: string) {
  await invoke("write_ssh_session", { sessionId, data });
}

export async function stopSshSession(sessionId: string) {
  await invoke("stop_ssh_session", { sessionId });
}
