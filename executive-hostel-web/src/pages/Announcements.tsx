import { useEffect, useState } from "react";
import { api, AnnouncementRow, ApiError } from "../lib/api";

const PRIORITY_COLOR: Record<string, string> = { normal: "var(--color-muted)", important: "var(--color-warning)", urgent: "var(--color-danger)" };

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.announcements().then(setAnnouncements).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, []);

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Announcements</h1>
      {!announcements && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {announcements?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No announcements yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {announcements?.map((a) => (
          <div key={a.id} className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLOR[a.priority]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{a.title}</strong>
              <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[a.priority], textTransform: "uppercase" }}>{a.priority}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "6px 0" }}>{a.message}</p>
            <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{new Date(a.publishedAt).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
