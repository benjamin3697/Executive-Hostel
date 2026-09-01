import { useCallback, useEffect, useState } from "react";
import { Unlock } from "lucide-react";
import { api, ApiError, LockedAccount } from "../lib/api";

export default function AdminSecurity() {
  const [accounts, setAccounts] = useState<LockedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.lockouts().then(setAccounts).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load lockouts."));
  }, []);
  useEffect(load, [load]);

  async function handleUnlock(account: LockedAccount) {
    setBusyId(account.id);
    setFeedback(null);
    try {
      await api.unlockAccount(account.id);
      setFeedback(`${account.student?.fullName ?? account.email ?? account.phone ?? "Account"} can sign in again.`);
      load();
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : "Failed to clear lockout.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 4 }}>Security</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 16 }}>
        Clear active 15-minute failed-login lockouts for staff and students.
      </p>
      {feedback && <div className="card" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)", marginBottom: 16, fontSize: 13 }}>{feedback}</div>}
      {error && <div style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</div>}
      {accounts?.length === 0 && <div className="card" style={{ color: "var(--color-muted)" }}>No active account lockouts.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {accounts?.map((account) => (
          <div key={account.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>{account.student?.fullName ?? account.email ?? account.phone ?? "Unnamed account"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
                {account.student?.registrationNumber ?? account.role} · Locked until {account.lockedUntil ? new Date(account.lockedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon"}
              </div>
            </div>
            <button className="btn btn-outline" disabled={busyId === account.id} onClick={() => handleUnlock(account)}>
              <Unlock size={14} /> {busyId === account.id ? "Clearing..." : "Clear lockout"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
