import { useEffect, useState } from "react";
import { Landmark, Phone } from "lucide-react";
import { api } from "../../lib/api";

// NOTE: this component is deliberately NOT routed anywhere in App.tsx.
// Payment/bank details are no longer public - see the backend README
// ("Payment info is no longer public") and SubmitPayment.tsx, which shows
// the same information to authenticated students with an assigned room.
// This file is kept only in case you want to build an authenticated
// "full payment details" page later; safe to delete otherwise.
export default function PaymentInfo() {
  const [info, setInfo] = useState<Record<string, string | null> | null>(null);

  useEffect(() => {
    api.paymentInfo().then(setInfo).catch(() => setInfo({}));
  }, []);

  if (!info) return <div style={{ padding: 24, color: "var(--color-muted)" }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 16 }}>How to Pay</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <Landmark size={18} color="var(--color-accent)" />
          <strong>Bank Payment — Highly Encouraged</strong>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 12 }}>
          Students are highly encouraged to make payments through the hostel bank account — it provides a clear transaction record.
        </p>
        <dl style={{ fontSize: 13 }}>
          {[["Bank", info.bank_name], ["Account Name", info.bank_account_name], ["Account Number", info.bank_account_number], ["Branch", info.bank_branch]].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
              <span style={{ color: "var(--color-muted)" }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value ?? "Not yet configured"}</span>
            </div>
          ))}
        </dl>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <Phone size={18} color="var(--color-primary)" />
          <strong>Telephone / Mobile Money</strong>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 8 }}>
          Use only this officially provided number for mobile money payments.
        </p>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>{info.mobile_money_number ?? "Not yet configured"}</div>
      </div>

      {info.payment_instructions && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13 }}>Instructions</strong>
          <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "6px 0 0" }}>{info.payment_instructions}</p>
        </div>
      )}
      {info.payment_deadline && (
        <div className="card">
          <strong style={{ fontSize: 13 }}>Payment Deadline</strong>
          <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "6px 0 0" }}>{info.payment_deadline}</p>
        </div>
      )}
    </div>
  );
}
