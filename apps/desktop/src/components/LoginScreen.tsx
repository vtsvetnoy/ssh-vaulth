import { FormEvent, useState } from "react";

import { SyncClient } from "../api/client";

type Props = {
  onSubmit: (
    mode: "login" | "register",
    email: string,
    password: string,
    serverUrl: string,
  ) => Promise<void>;
};

export function LoginScreen({ onSubmit }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:18080");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "checking" | "online" | "offline">(
    "idle",
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(mode, email, password, serverUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    }
  }

  async function checkSync() {
    setError("");
    setSyncStatus("checking");
    try {
      await new SyncClient(serverUrl).health();
      setSyncStatus("online");
    } catch (err) {
      setSyncStatus("offline");
      setError(err instanceof Error ? err.message : "Sync API unavailable");
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h1>SSH Vault</h1>
      <label>Sync server</label>
      <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
      <button className={`sync-check ${syncStatus}`} type="button" onClick={checkSync}>
        {syncStatus === "checking"
          ? "Checking sync API"
          : syncStatus === "online"
            ? "Sync API connected"
            : syncStatus === "offline"
              ? "Sync API offline"
              : "Check sync API"}
      </button>
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit">
        {mode === "login" ? "Login" : "Register"}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Create account" : "Use existing account"}
      </button>
    </form>
  );
}
