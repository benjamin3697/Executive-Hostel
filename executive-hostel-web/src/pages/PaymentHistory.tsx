import { useEffect, useState } from "react";
import { api, PaymentHistoryRow, ApiError } from "../lib/api";
import { fmt, StatusBadge } from "../lib/format";

export default function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myPayments().then(setPayments).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, []);

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Payment History</h1>
      {!payments && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {payments?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No payments submitted yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {payments?.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{fmt(p.amount)}</span>
              <StatusBadge status={p.status} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
              {p.paymentMethod} · {new Date(p.paymentDate).toLocaleDateString()} · submitted {new Date(p.submittedAt).toLocaleDateString()}
            </div>
            {p.rejectionReason && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--color-danger)" }}>Rejected: {p.rejectionReason}</div>
            )}
            {p.adminRemarks && p.status === "clarification_requested" && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--color-warning)" }}>Clarification needed: {p.adminRemarks}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
