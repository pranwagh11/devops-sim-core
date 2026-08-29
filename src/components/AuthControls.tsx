import { useState } from "react";
import { useAuth } from "../auth";

export default function AuthControls() {
  const { role, adminAvailable, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const closePanel = () => {
    setOpen(false);
    setUsername("");
    setPassphrase("");
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const ok = await login(username.trim(), passphrase);
      if (ok) closePanel();
      else setError("Incorrect username or key.");
    } finally {
      setBusy(false);
    }
  };

  if (role === "admin") {
    return (
      <div className="auth-controls">
        <span className="admin-badge">Admin ✓</span>
        <button className="nav-action" onClick={logout}>Log out</button>
      </div>
    );
  }

  if (!adminAvailable) {
    return (
      <div className="auth-controls">
        <span className="admin-badge admin-badge-muted" title="admin-seed.json wasn't found or failed to load">
          Admin login unavailable
        </span>
      </div>
    );
  }

  return (
    <div className="auth-controls">
      <button className="nav-action" onClick={() => setOpen((o) => !o)}>Admin Login</button>
      {open && (
        <div className="auth-panel">
          <p className="auth-panel-note">
            This is a local access gate for this browser, not real authentication — see README for
            details. The credential was generated offline and is never created or changed from
            inside this app.
          </p>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="field-group">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="iamuser" autoFocus />
            </div>
            <div className="field-group">
              <label>Key</label>
              <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
              <button type="button" className="btn-secondary" onClick={closePanel}>Cancel</button>
            </div>
          </form>
          <p className="auth-panel-note" style={{ marginTop: 10, marginBottom: 0 }}>
            Lost the key? It can't be recovered or reset from here — regenerate a new credential
            with the offline tool and redeploy.
          </p>
        </div>
      )}
    </div>
  );
}
