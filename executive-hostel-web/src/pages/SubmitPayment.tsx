import { useEffect, useState, FormEvent } from "react";
import { Upload, Landmark, Phone } from "lucide-react";
import { api, uploadEvidenceFile, ApiError, PaymentSummary } from "../lib/api";
import { fmt } from "../lib/format";

export default function SubmitPayment() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [bankInfo, setBankInfo] = useState<Record<string, string | null> | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [payerName, setPayerName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.allSettled([api.paymentSummary().then(setSummary), api.paymentInfo().then(setBankInfo)])
      .finally(() => setLoaded(true));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError("Enter the amount you paid.");
      return;
    }
    if (!file) {
      setError("Please attach your payment screenshot or receipt.");
      return;
    }
    setSubmitting(true);
    try {
      const fileType = file.type === "application/pdf" ? "pdf" : "image";
      const key = await uploadEvidenceFile(file, fileType);
      await api.submitPayment({
        amount: Number(amount),
        paymentMethod: method,
        paymentDate: new Date(date).toISOString(),
        transactionReference: reference || undefined,
        payerName: payerName || undefined,
        remarks: remarks || undefined,
        evidence: [{ key, fileType }],
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          <h2 className="font-display" style={{ fontSize: 20 }}>Payment submitted</h2>
          <p style={{ fontSize: 14, color: "var(--color-muted)" }}>
            Your payment is now <strong>pending verification</strong>. It won't count toward your paid balance until an administrator reviews it.
          </p>
          <button className="btn btn-primary" onClick={() => setSuccess(false)}>Submit another</button>
        </div>
      </div>
    );
  }

  if (loaded && summary?.status === "no_active_accommodation") {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--color-muted)" }}>
          You don't have a room assigned yet, so there's nothing to pay for right now. Payment details become available once hostel administration assigns you a room.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Submit Payment</h1>

      {summary && (
        <div className="card mobile-two-column" style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
          <div><span style={{ color: "var(--color-muted)" }}>Fee</span><div style={{ fontWeight: 700 }}>{fmt(summary.fee)}</div></div>
          <div><span style={{ color: "var(--color-muted)" }}>Balance</span><div style={{ fontWeight: 700, color: "var(--color-danger)" }}>{fmt(summary.balance)}</div></div>
        </div>
      )}

      {bankInfo && (
        <div className="mobile-two-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div className="card">
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <Landmark size={16} color="var(--color-accent)" /> <strong style={{ fontSize: 13 }}>Bank — Preferred</strong>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
              {bankInfo.bank_name ?? "Not yet configured"} · Acc: {bankInfo.bank_account_number ?? "—"}
            </div>
          </div>
          <div className="card">
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <Phone size={16} color="var(--color-primary)" /> <strong style={{ fontSize: 13 }}>Mobile Money</strong>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>{bankInfo.mobile_money_number ?? "Not yet configured"}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Amount paid (UGX)</label>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 650000"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          style={{ marginBottom: 12 }}
        />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Payment method</label>
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="bank">Bank</option>
          <option value="mobile_money">Mobile Money</option>
          <option value="other">Other</option>
        </select>

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Payment date</label>
        <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Transaction / reference number</label>
        <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} style={{ marginBottom: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Payer name (optional, if paid by someone else)</label>
        <input className="input" value={payerName} onChange={(e) => setPayerName(e.target.value)} style={{ marginBottom: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Remarks (optional)</label>
        <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{ marginBottom: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Payment evidence (screenshot or PDF receipt)</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 16, fontSize: 13 }}
        />

        {error && (
          <div style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          <Upload size={16} /> {submitting ? "Submitting..." : "Submit Payment Evidence"}
        </button>
      </form>
    </div>
  );
}
