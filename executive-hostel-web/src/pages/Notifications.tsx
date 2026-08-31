import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { api, NotificationRow, ApiError } from "../lib/api";

// Renders a human-readable line from a notification's type + payload,
// since the backend stores payload as free-form JSON (see docs Section 49
// - each route that creates a notification sets its own payload shape).
function describe(n: NotificationRow): string {
  const p = n.payload ?? {};
  switch (n.type) {
    case "payment.submitted": return `New payment submitted: ${p.studentName ?? "a student"} - UGX ${Number(p.amount ?? 0).toLocaleString()}`;
    case "payment.verified": return `Your payment of UGX ${Number(p.amount ?? 0).toLocaleString()} was verified.`;
    case "payment.rejected": return `Your payment was rejected: ${p.reason ?? "see payment history for details"}`;
    case "payment.clarification_requested": return `Clarification needed on your payment: ${p.message ?? ""}`;
    case "announcement.new": return `New announcement: ${p.title ?? ""}`;
    case "maintenance.submitted": return `New maintenance request: ${p.category ?? ""}`;
    case "maintenance.status_changed": return `Your maintenance request is now "${p.status ?? ""}".`;
    default: return n.type.replace(/\./g, " ").replace(/_/g, " ");
  }
}

export default function Notifications() {
  const [data, setData] = useState<{ unreadCount: number; notifications: NotificationRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.notifications().then(setData).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }
  useEffect(load, []);

  async function markRead(id: string) {
    await api.markNotificationRead(id).catch(() => {});
    load();
  }

  async function markAllRead() {
    await api.markAllNotificationsRead().catch(() => {});
    load();
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="font-display" style={{ fontSize: 22 }}>Notifications</h1>
        {!!data?.unreadCount && (
          <button onClick={markAllRead} className="btn btn-outline" style={{ fontSize: 12 }}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {!data && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {data?.notifications.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No notifications yet.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data?.notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.isRead && markRead(n.id)}
            className="card"
            style={{
              textAlign: "left", width: "100%", cursor: n.isRead ? "default" : "pointer",
              background: n.isRead ? "#fff" : "var(--color-primary-soft)",
              border: n.isRead ? "1px solid var(--color-border)" : "1px solid var(--color-primary)",
            }}
          >
            <div style={{ fontSize: 13 }}>{describe(n)}</div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>{new Date(n.createdAt).toLocaleString()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
