import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { api, Payment, ApiError } from "../lib/api";

const fmt = (n: number) => "UGX " + n.toLocaleString();

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.pendingPayments()
      .then((r) => setPayments(r.payments))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load payments."));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.verifyPayment(id);
      setPayments((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to verify payment.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason) return;
    setBusyId(id);
    try {
      await api.rejectPayment(id, reason);
      setPayments((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to reject payment.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleClarify(id: string) {
    const message = prompt("What additional information is needed?");
    if (!message) return;
    setBusyId(id);
    try {
      await api.requestClarification(id, message);
      setPayments((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to request clarification.");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>
        Pending Verifications{payments ? `: ${payments.length}` : ""}
      </h1>

      {!payments && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {payments?.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--color-muted)", borderStyle: "dashed" }}>
          Nothing waiting for review right now.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {payments?.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.student.fullName}</div>
                <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                  {p.room ? `${p.room.section.name} ${p.room.roomNumber}` : "No room"} · {p.paymentMethod}
                  {p.transactionReference ? ` · Ref ${p.transactionReference}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(p.amount)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button disabled={busyId === p.id} onClick={() => handleApprove(p.id)} className="btn btn-accent">
                <CheckCircle2 size={15} /> Approve
              </button>
              <button disabled={busyId === p.id} onClick={() => handleReject(p.id)} className="btn btn-danger">
                <XCircle size={15} /> Reject
              </button>
              <button disabled={busyId === p.id} onClick={() => handleClarify(p.id)} className="btn btn-outline">
                <AlertTriangle size={15} /> Request Clarification
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
