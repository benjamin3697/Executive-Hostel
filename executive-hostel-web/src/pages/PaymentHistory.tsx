import { useEffect, useState } from "react";
import {
  CheckCircle2, Clock, XCircle, AlertCircle, Banknote,
  Smartphone, HelpCircle, ChevronDown, ChevronUp, Receipt,
  TrendingUp, Wallet, AlertTriangle,
} from "lucide-react";
import { api, PaymentHistoryRow, PaymentSummary, ApiError } from "../lib/api";
import { fmt, formatUGX } from "../lib/format";

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  verified:               { label: "Verified",              color: "var(--color-accent)",  icon: <CheckCircle2  size={14} /> },
  pending:                { label: "Pending",               color: "var(--color-warning)", icon: <Clock         size={14} /> },
  rejected:               { label: "Rejected",              color: "var(--color-danger)",  icon: <XCircle       size={14} /> },
  clarification_requested:{ label: "Clarification Needed",  color: "#f59e0b",              icon: <AlertCircle   size={14} /> },
};

const METHOD_META: Record<string, { label: string; icon: React.ReactNode }> = {
  bank:         { label: "Bank Transfer", icon: <Banknote    size={14} /> },
  mobile_money: { label: "Mobile Money",  icon: <Smartphone  size={14} /> },
  other:        { label: "Other",         icon: <HelpCircle  size={14} /> },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: "var(--color-muted)", icon: <HelpCircle size={14} /> };
}
function methodMeta(m: string) {
  return METHOD_META[m] ?? { label: m, icon: <HelpCircle size={14} /> };
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

function numericAmount(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function paymentProgress(verifiedPaid: number, totalFee: number | null) {
  if (!totalFee || totalFee <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((verifiedPaid / totalFee) * 100)));
}

function overallPaymentStatus(summary: PaymentSummary) {
  if (summary.status === "fully_paid") return { label: "Fully Paid", tone: "success" };
  if (summary.status === "partially_paid") return { label: "Partially Paid", tone: "warning" };
  return { label: "Unpaid / Overdue", tone: "danger" };
}

// ── Balance Banner ────────────────────────────────────────────────────────────
function BalanceBanner({ summary }: { summary: PaymentSummary }) {
  const isFullyPaid  = summary.status === "fully_paid";
  const isOutstanding = summary.status === "outstanding";

  const accentColor = isFullyPaid ? "var(--color-accent)" : isOutstanding ? "var(--color-danger)" : "var(--color-warning)";
  const bgColor     = isFullyPaid ? "rgba(34,197,94,0.08)"  : isOutstanding ? "rgba(239,68,68,0.08)"  : "rgba(245,158,11,0.08)";
  const progress = paymentProgress(numericAmount(summary.verifiedPaid), summary.effectiveFee ?? summary.fee);
  const status = overallPaymentStatus(summary);

  return (
    <div style={{
      borderRadius: 16, padding: "20px 24px", marginBottom: 24,
      background: bgColor, border: `1.5px solid ${accentColor}`,
      display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: bgColor, border: `2px solid ${accentColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isFullyPaid ? <CheckCircle2 size={26} color={accentColor} /> : <Wallet size={26} color={accentColor} />}
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {isFullyPaid ? "All Cleared!" : isOutstanding ? "Payment Outstanding" : "Partially Paid"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
          {isFullyPaid ? "No balance due" : `${fmt(summary.balance)} remaining`}
        </div>
        <span className={`payment-status-badge payment-status-${status.tone}`}>{status.label}</span>
        {summary.carriedBalance > 0 && (
          <div style={{ fontSize: 12, color: "var(--color-warning)", marginTop: 4 }}>
            Includes {fmt(summary.carriedBalance)} carried over from previous semester
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
        {[
          { label: summary.carriedBalance > 0 ? "Semester Fee" : "Total Fee", val: summary.fee },
          { label: "Verified Paid",    val: summary.verifiedPaid },
          { label: "Pending",          val: summary.pendingAmount > 0 ? summary.pendingAmount : null },
          ...(summary.carriedBalance > 0 ? [{ label: "Total Due", val: summary.effectiveFee }] : []),
        ].filter(r => r.val !== null && r.val !== undefined).map(r => (
          <div key={r.label}>
            <div style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase" }}>{r.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(r.val as number | null)}</div>
          </div>
        ))}
      </div>
      <div className="payment-progress-wrap"><div className="payment-progress-label"><span>Paid progress</span><strong>{progress}%</strong></div><div className="payment-progress-track"><div className={`payment-progress-fill payment-progress-${status.tone}`} style={{ width: `${progress}%` }} /></div></div>
    </div>
  );
}

// ── Single Payment Row ────────────────────────────────────────────────────────
function PaymentRow({ p }: { p: PaymentHistoryRow }) {
  const [open, setOpen] = useState(false);
  const sm = statusMeta(p.status);
  const mm = methodMeta(p.paymentMethod);
  const hasDetail = p.rejectionReason || p.adminRemarks || p.transactionReference || p.verifiedAt || (p.evidence?.length ?? 0) > 0;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", transition: "box-shadow 0.15s" }}>
      {/* Main row */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
          cursor: hasDetail ? "pointer" : "default",
        }}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: sm.color, boxShadow: `0 0 6px ${sm.color}88`,
        }} />

        {/* Amount */}
        <div style={{ fontWeight: 800, fontSize: 16, minWidth: 110 }}>{fmt(p.amount)}</div>

        {/* Method pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
          borderRadius: 20, background: "var(--color-surface-raised, #1a1a2e)",
          fontSize: 12, color: "var(--color-muted)", flexShrink: 0,
        }}>
          {mm.icon} {mm.label}
        </div>

        {/* Dates */}
        <div style={{ flex: 1, fontSize: 12, color: "var(--color-muted)" }}>
          <span>Payment date: <strong style={{ color: "var(--color-text)" }}>{fmtDate(p.paymentDate)}</strong></span>
          <span style={{ marginLeft: 12, opacity: 0.7 }}>Submitted: {fmtDate(p.submittedAt)}</span>
        </div>

        {/* Status badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 20,
          background: `${sm.color}18`, color: sm.color,
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {sm.icon} {sm.label}
        </div>

        {/* Expand chevron */}
        {hasDetail && (
          <div style={{ color: "var(--color-muted)", flexShrink: 0 }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{
          borderTop: "1px solid var(--color-border)", padding: "14px 18px",
          background: "rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 8,
        }}>
          {p.transactionReference && (
            <div style={{ fontSize: 12.5 }}>
              <span style={{ color: "var(--color-muted)" }}>Transaction ref: </span>
              <strong>{p.transactionReference}</strong>
            </div>
          )}
          {p.rejectionReason && (
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              fontSize: 12.5, color: "var(--color-danger)",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div><strong>Rejection reason: </strong>{p.rejectionReason}</div>
            </div>
          )}
          {p.adminRemarks && p.status === "clarification_requested" && (
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
              fontSize: 12.5, color: "#f59e0b",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div><strong>Clarification needed: </strong>{p.adminRemarks}</div>
            </div>
          )}
          {p.adminRemarks && p.status === "verified" && (
            <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
              Admin note: {p.adminRemarks}
            </div>
          )}
          {p.verifiedAt && <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>Verified: <strong style={{ color: "var(--color-text)" }}>{fmtDate(p.verifiedAt)}</strong></div>}
          {(p.evidence?.length ?? 0) > 0 && <div className="payment-evidence-list"><strong>Receipt uploads</strong>{p.evidence?.map((evidence) => <a key={evidence.id} href={evidence.downloadUrl ?? evidence.fileUrl} target="_blank" rel="noreferrer" className="receipt-link"><Receipt size={14} /> {evidence.fileType === "pdf" ? "View PDF receipt" : "Preview receipt"}</a>)}</div>}
          {p.status === "verified" && p.evidence?.[0] && <a className="btn btn-primary receipt-download" href={p.evidence[0].downloadUrl ?? p.evidence[0].fileUrl} target="_blank" rel="noreferrer"><Receipt size={14} /> Download Official Receipt</a>}
        </div>
      )}
    </div>
  );
}

// ── Page Root ─────────────────────────────────────────────────────────────────
export default function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentHistoryRow[] | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "pending" | "rejected" | "clarification_requested">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.myPayments(), api.paymentSummary()])
      .then(([pmts, sum]) => { setPayments(pmts); setSummary(sum); })
      .catch(err => setError(err instanceof ApiError ? err.message : "Failed to load payment history."));
  }, []);

  if (error) return (
    <div style={{ padding: 24, maxWidth: 740, margin: "0 auto" }}>
      <div className="card" style={{ color: "var(--color-danger)", display: "flex", gap: 10, alignItems: "center" }}>
        <XCircle size={18} /> {error}
      </div>
    </div>
  );

  const filtered = payments?.filter(p => filter === "all" || p.status === filter) ?? [];

  // Summary totals
  const totalVerified = payments?.filter(p => p.status === "verified").reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) ?? 0;
  const totalPending = payments?.filter(p => p.status === "pending").reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) ?? 0;
  const progress = summary ? paymentProgress(totalVerified, summary.effectiveFee ?? summary.fee) : 0;

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all",                    label: "All" },
    { key: "verified",               label: "Verified" },
    { key: "pending",                label: "Pending" },
    { key: "clarification_requested",label: "Clarification" },
    { key: "rejected",               label: "Rejected" },
  ];

  return (
    <div style={{ padding: "24px 20px", maxWidth: 740, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: "var(--color-primary-soft)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Receipt size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h1 className="font-display" style={{ fontSize: 22, margin: 0 }}>Payment History</h1>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
            {!payments ? "Loading…" : `${payments.length} payment${payments.length !== 1 ? "s" : ""} on record`}
          </div>
        </div>
      </div>

      {/* Balance Summary Banner */}
      {summary && <BalanceBanner summary={summary} />}

      {/* Quick Stats */}
      {payments && payments.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Submitted",   value: payments.length,       icon: <Receipt     size={16} />, color: "var(--color-primary)" },
            { label: "Verified Amount",   value: formatUGX(totalVerified), icon: <TrendingUp  size={16} />, color: "var(--color-accent)"  },
            { label: "Pending Amount",    value: formatUGX(totalPending),  icon: <Clock       size={16} />, color: "var(--color-warning)" },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: stat.color }}>
                {stat.icon}
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}
      {summary && <div className="payment-history-progress card"><div><strong>Payment progress</strong><span>{progress}% of {formatUGX(numericAmount(summary.effectiveFee ?? summary.fee))} verified</span></div><div className="payment-progress-track"><div className="payment-progress-fill payment-progress-success" style={{ width: `${progress}%` }} /></div></div>}

      {/* Filter Tabs */}
      {payments && payments.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {FILTERS.map(f => {
            const count = payments.filter(p => f.key === "all" || p.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="btn btn-outline"
                style={{
                  fontSize: 12, padding: "5px 12px",
                  background: filter === f.key ? "var(--color-primary)" : "transparent",
                  color:      filter === f.key ? "#fff" : "var(--color-muted)",
                  border:     filter === f.key ? "1px solid var(--color-primary)" : undefined,
                }}
              >
                {f.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {!payments && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ height: 64, background: "var(--color-surface-raised, #1a1a2e)", opacity: 0.5 }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {payments?.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--color-muted)" }}>
          <Receipt size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No payments yet</div>
          <div style={{ fontSize: 13 }}>Your submitted payments will appear here.</div>
        </div>
      )}

      {/* No filter results */}
      {payments && payments.length > 0 && filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--color-muted)", fontSize: 13 }}>
          No payments with status "{FILTERS.find(f => f.key === filter)?.label}".
        </div>
      )}

      {/* Payment list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => <PaymentRow key={p.id} p={p} />)}
      </div>
    </div>
  );
}
