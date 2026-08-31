import { useEffect, useState, useCallback } from "react";
import { api, MaintenanceRow, ApiError } from "../lib/api";
import { StatusBadge } from "../lib/format";

const STATUSES = ["submitted", "in_progress", "resolved", "closed"];

export default function AdminMaintenance() {
  const [requests, setRequests] = useState<MaintenanceRow[] | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.adminMaintenance({ status })
      .then((r) => setRequests(r.requests))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function advance(id: string, next: string) {
    setBusyId(id);
    try {
      await api.updateMaintenanceStatus(id, next);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update.");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Maintenance Requests</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? undefined : s)}
            className="btn"
            style={{ background: status === s ? "var(--color-primary)" : "#fff", color: status === s ? "#fff" : "var(--color-text)", borderColor: "var(--color-border)", fontSize: 12 }}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {!requests && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests?.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>{r.category.replace(/_/g, " ")}</div>
                <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                  {r.student?.fullName} {r.room && `· ${r.room.section.name} Room ${r.room.roomNumber}`}
                </div>
              </div>
              <StatusBadge status={r.status} label={r.status.replace(/_/g, " ")} />
            </div>
            <p style={{ fontSize: 13, margin: "8px 0" }}>{r.description}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {r.status === "submitted" && (
                <button disabled={busyId === r.id} className="btn btn-outline" onClick={() => advance(r.id, "in_progress")}>Start Work</button>
              )}
              {r.status === "in_progress" && (
                <button disabled={busyId === r.id} className="btn btn-accent" onClick={() => advance(r.id, "resolved")}>Mark Resolved</button>
              )}
              {r.status === "resolved" && (
                <button disabled={busyId === r.id} className="btn btn-outline" onClick={() => advance(r.id, "closed")}>Close</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
