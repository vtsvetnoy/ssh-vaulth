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
  return await withTimeout(
    invoke<string>("start_ssh_session", {
      host: {
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        auth: host.auth,
      },
    }),
    5000,
    "SSH start did not return from the desktop backend within 5 seconds.",
  );
}

export async function writeSshSession(sessionId: string, data: string) {
  await invoke("write_ssh_session", { sessionId, data });
}

export async function stopSshSession(sessionId: string) {
  await invoke("stop_ssh_session", { sessionId });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: number | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}
