import { FormEvent, useState } from "react";

type Props = {
  hasRemoteVault: boolean;
  onUnlock: (masterPassword: string) => Promise<void>;
};

export function UnlockScreen({ hasRemoteVault, onUnlock }: Props) {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onUnlock(masterPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h1>Open vault</h1>
      <p className="panel-note">
        {hasRemoteVault
          ? "Enter the master password for this encrypted vault."
          : "Enter a master password to open your private encrypted vault."}
      </p>
      <label>Master password</label>
      <input
        type="password"
        value={masterPassword}
        onChange={(e) => setMasterPassword(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit">
        Continue
      </button>
    </form>
  );
}
