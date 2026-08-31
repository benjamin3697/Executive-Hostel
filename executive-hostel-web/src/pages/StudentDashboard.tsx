import { useEffect, useState } from "react";
import { DoorOpen, AlertTriangle, Wrench } from "lucide-react";
import { api, StudentDashboard as DashboardData, ApiError } from "../lib/api";

const fmt = (n: number | null) => (n === null ? "—" : "UGX " + n.toLocaleString());

const STATUS_LABEL: Record<string, string> = {
  fully_paid: "Fully Paid",
  partially_paid: "Partially Paid",
  outstanding: "Outstanding",
  no_active_accommodation: "No accommodation assigned yet",
};

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.studentDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard."));
  }, []);

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;
  if (!data) return <div style={{ padding: 24, color: "var(--color-muted)" }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 20 }}>
        Welcome, {data.student.fullName.split(" ")[0]}
      </h1>

      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--color-primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <DoorOpen size={24} color="var(--color-primary)" />
        </div>
        {data.accommodation ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase" }}>{data.accommodation.section}</div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 600 }}>Room {data.accommodation.roomNumber}</div>
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>{data.accommodation.roomType} · Reg No. {data.student.registrationNumber}</div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--color-muted)" }}>No room assigned yet.</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Fee", value: fmt(data.payment.fee) },
          { label: "Verified Paid", value: fmt(data.payment.verifiedPaid) },
          { label: "Pending Verification", value: fmt(data.payment.pendingAmount) },
          { label: "Outstanding Balance", value: fmt(data.payment.balance) },
        ].map((s) => (
          <div key={s.label} className="card">
            <div style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20, display: "inline-block" }}>
        <span className="badge" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
          {STATUS_LABEL[data.payment.status] ?? data.payment.status}
        </span>
      </div>

      {data.urgentAnnouncements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {data.urgentAnnouncements.map((a) => (
            <div key={a.id} className="card" style={{ borderLeft: `4px solid var(--color-warning)`, marginBottom: 10, display: "flex", gap: 10 }}>
              <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 14 }}>{a.title}</strong>
                <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0 0" }}>{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.openMaintenanceRequests > 0 && (
        <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Wrench size={18} color="var(--color-primary)" />
          <span style={{ fontSize: 13 }}>{data.openMaintenanceRequests} open maintenance request(s)</span>
        </div>
      )}
    </div>
  );
}
