import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, Archive } from "lucide-react";
import { api, ApplicationRow, ApiError } from "../lib/api";
import { StatusBadge } from "../lib/format";

export default function AdminApplications() {
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);
  const [status, setStatus] = useState<string | undefined>("submitted");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvedInfo, setApprovedInfo] = useState<{ message: string; password?: string } | null>(null);

  const load = useCallback(() => {
    api.applications({ status })
      .then((r) => setApplications(r.applications))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      const result = await api.approveApplication(id);
      setApprovedInfo(
        result.deliveryMethod === "manual"
          ? { message: result.message, password: result.temporaryPassword }
          : { message: result.message }
      );
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to approve.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecision(id: string, decision: string) {
    setBusyId(id);
    try {
      await api.decideApplication(id, decision);
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
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Applications</h1>

      {approvedInfo && (
        <div className="card" style={{ background: "var(--color-accent-soft)", marginBottom: 16, borderColor: "var(--color-accent)" }}>
          <strong style={{ fontSize: 13 }}>Application approved.</strong>
          <p style={{ fontSize: 12.5, margin: "6px 0" }}>{approvedInfo.message}</p>
          {approvedInfo.password && (
            <p style={{ fontSize: 12.5, margin: "6px 0" }}>
              Temporary password: <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{approvedInfo.password}</code>
            </p>
          )}
          <p style={{ fontSize: 11.5, color: "var(--color-muted)" }}>You can now assign them a room from the Rooms page.</p>
          <button className="btn btn-outline" onClick={() => setApprovedInfo(null)} style={{ marginTop: 8 }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["submitted", "under_review", "approved", "rejected", "waitlisted"].map((s) => (
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

      {!applications && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {applications?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No applications here.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {applications?.map((a) => (
          <div key={a.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{a.fullName}</div>
                <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                  {a.phone} {a.email && `· ${a.email}`} {a.course && `· ${a.course}`}
                  {a.registrationNumber && ` · ${a.registrationNumber}`}
                </div>
              </div>
              <StatusBadge status={a.status} label={a.status} />
            </div>
            {a.preferredRoom && (
              <div style={{ fontSize: 12.5, color: "var(--color-accent)", fontWeight: 600, marginTop: 10 }}>
                Requested room: {a.preferredRoom.section.name} - Room {a.preferredRoom.roomNumber}
              </div>
            )}
            {(a.status === "submitted" || a.status === "under_review") && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button disabled={busyId === a.id} onClick={() => handleApprove(a.id)} className="btn btn-accent">
                  <CheckCircle2 size={14} /> Approve
                </button>
                {a.status === "submitted" && (
                  <button disabled={busyId === a.id} onClick={() => handleDecision(a.id, "under_review")} className="btn btn-outline">
                    <Clock size={14} /> Mark Under Review
                  </button>
                )}
                <button disabled={busyId === a.id} onClick={() => handleDecision(a.id, "waitlisted")} className="btn btn-outline">
                  <Archive size={14} /> Waitlist
                </button>
                <button disabled={busyId === a.id} onClick={() => handleDecision(a.id, "rejected")} className="btn btn-danger">
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
