import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

import {
  startSshSession,
  stopSshSession,
  writeSshSession,
  type SshExitEvent,
  type SshOutputEvent,
} from "../terminal/session";
import type { HostRecord } from "../types";

type Props = {
  active: boolean;
  host: HostRecord;
  onClose: () => void;
};

export function SshTerminal({ active, host, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState("Starting SSH");

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        "JetBrains Mono, SFMono-Regular, Consolas, Liberation Mono, monospace",
      fontSize: 13,
      theme: {
        background: "#111827",
        foreground: "#e5e7eb",
        cursor: "#f9fafb",
        selectionBackground: "#374151",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(containerRef.current!);
    fit.fit();
    terminal.writeln(`Starting local ssh for ${host.label}`);
    terminal.writeln(`Target: ${host.username} @ ${host.hostname}:${host.port}`);

    terminalRef.current = terminal;
    fitRef.current = fit;

    const disposables: UnlistenFn[] = [];
    const dataDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (sessionId) void writeSshSession(sessionId, data);
    });

    async function connect() {
      try {
        terminal.writeln("[preparing ssh event listeners]");
        const [outputUnlisten, exitUnlisten] = await withUiTimeout(
          Promise.all([
            listen<SshOutputEvent>("ssh://output", (event) => {
              if (event.payload.sessionId === sessionIdRef.current) {
                terminal.write(event.payload.data);
              }
            }),
            listen<SshExitEvent>("ssh://exit", (event) => {
              if (event.payload.sessionId === sessionIdRef.current) {
                setStatus("Disconnected");
                terminal.writeln("");
                terminal.writeln("[session closed]");
              }
            }),
          ]),
          3000,
          "SSH event listeners did not become ready within 3 seconds.",
        );
        disposables.push(outputUnlisten, exitUnlisten);
        terminal.writeln("[event listeners ready]");
        terminal.writeln("[requesting desktop backend to start ssh]");
        const sessionId = await startSshSession(host);
        sessionIdRef.current = sessionId;
        setStatus("SSH started");
        terminal.writeln("[ssh process started]");
      } catch (err) {
        setStatus("Failed");
        terminal.writeln("");
        terminal.writeln(err instanceof Error ? err.message : "SSH failed");
        terminal.writeln(
          "Check that local ssh can start, the host is reachable, and the saved credentials are valid.",
        );
      }
    }

    const resize = () => fit.fit();
    window.addEventListener("resize", resize);
    void connect();

    return () => {
      window.removeEventListener("resize", resize);
      for (const dispose of disposables) dispose();
      dataDisposable.dispose();
      const sessionId = sessionIdRef.current;
      if (sessionId) void stopSshSession(sessionId);
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      sessionIdRef.current = null;
    };
  }, [host]);

  useEffect(() => {
    if (active) {
      window.setTimeout(() => fitRef.current?.fit(), 0);
    }
  }, [active]);

  return (
    <div className="terminal-panel">
      <div className="terminal-toolbar">
        <div>
          <strong>{host.label}</strong>
          <span>{status}</span>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div ref={containerRef} className="terminal-surface" />
    </div>
  );
}

async function withUiTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
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
