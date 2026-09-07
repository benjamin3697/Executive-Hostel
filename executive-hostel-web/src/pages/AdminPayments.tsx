import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle,
  Image as ImageIcon, FileText, Download,
  ZoomIn, X, Eye, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { api, Payment, PaymentEvidence, ApiError } from "../lib/api";

const fmt = (n: number) => "UGX " + n.toLocaleString();

// ─── Full-screen lightbox ──────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 20, cursor: "zoom-out",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
          width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#fff",
        }}
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt="Payment receipt"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain",
          borderRadius: 10, boxShadow: "0 8px 60px rgba(0,0,0,0.7)",
          cursor: "default",
        }}
      />
      <a
        href={src}
        download="payment-receipt.jpg"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 20, right: 20,
          background: "var(--color-accent, #7c3aed)", color: "#fff",
          border: "none", borderRadius: 8, padding: "8px 16px",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none",
        }}
      >
        <Download size={14} /> Download
      </a>
    </div>
  );
}

// ─── Single evidence file tile ─────────────────────────────────────────────────
function EvidenceTile({ ev, onPreview }: { ev: PaymentEvidence; onPreview: (url: string) => void }) {
  const url = ev.downloadUrl ?? ev.fileUrl;
  const isImage = ev.fileType === "image";

  function handleDownload() {
    const a = document.createElement("a");
    a.href = url;
    a.download = isImage ? "payment-receipt.jpg" : "payment-receipt.pdf";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div style={{
      border: "1px solid var(--color-border)", borderRadius: 10,
      overflow: "hidden", background: "var(--color-surface)", display: "flex",
      flexDirection: "column",
    }}>
      {isImage ? (
        <div
          onClick={() => onPreview(url)}
          style={{
            cursor: "zoom-in", position: "relative", background: "#111",
            height: 148, display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={url}
            alt="Receipt"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.0)", transition: "background 0.15s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.35)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0)"; }}
          >
            <ZoomIn size={30} color="#fff" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.7))" }} />
          </div>
        </div>
      ) : (
        <div style={{
          height: 148, background: "var(--color-surface-raised, #1a1a2e)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 8,
        }}>
          <FileText size={42} color="var(--color-muted)" />
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>PDF Receipt</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, padding: "8px 10px" }}>
        {isImage ? (
          <button
            className="btn btn-outline"
            onClick={() => onPreview(url)}
            style={{ flex: 1, fontSize: 12, padding: "5px 8px", justifyContent: "center" }}
          >
            <ZoomIn size={12} /> Preview
          </button>
        ) : (
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            className="btn btn-outline"
            style={{ flex: 1, fontSize: 12, padding: "5px 8px", justifyContent: "center", textDecoration: "none" }}
          >
            <Eye size={12} /> Open PDF
          </a>
        )}
        <button
          className="btn btn-outline"
          onClick={handleDownload}
          style={{ fontSize: 12, padding: "5px 10px" }}
          title="Download this file"
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Individual payment card with expandable evidence panel ────────────────────
function PaymentCard({
  payment, busy,
  onApprove, onReject, onClarify,
}: {
  payment: Payment; busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClarify: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detailEvidence, setDetailEvidence] = useState<PaymentEvidence[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const hasEvidence = (payment.evidence?.length ?? 0) > 0;

  async function toggleEvidence() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (!detailEvidence) {
      setLoadingEvidence(true);
      try {
        // The /:id endpoint returns evidence with short-lived signed downloadUrls
        const detail = await api.getPayment(payment.id);
        setDetailEvidence(detail.evidence ?? []);
      } catch {
        // Fall back to the URLs we already have from the list endpoint
        setDetailEvidence(payment.evidence ?? []);
      } finally {
        setLoadingEvidence(false);
      }
    }
  }

  const evidenceToShow = detailEvidence ?? payment.evidence ?? [];

  function downloadAll() {
    evidenceToShow.forEach((ev, i) => {
      const url = ev.downloadUrl ?? ev.fileUrl;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `payment-receipt-${i + 1}.${ev.fileType === "pdf" ? "pdf" : "jpg"}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  }

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{payment.student.fullName}</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                <strong>{payment.student.registrationNumber}</strong>
                {payment.room ? ` · ${payment.room.section.name} ${payment.room.roomNumber}` : " · No room"}
                {" · "}
                <span style={{ textTransform: "capitalize" }}>
                  {payment.paymentMethod.replace(/_/g, " ")}
                </span>
                {payment.transactionReference ? ` · Ref: ${payment.transactionReference}` : ""}
              </div>
              {payment.payerName && (
                <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                  Paid by: <strong>{payment.payerName}</strong>
                </div>
              )}
              {payment.remarks && (
                <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2, fontStyle: "italic" }}>
                  "{payment.remarks}"
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 3 }}>
                Submitted {new Date(payment.submittedAt).toLocaleString()}
                &nbsp;·&nbsp;Payment date: {new Date(payment.paymentDate).toLocaleDateString()}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-accent)", whiteSpace: "nowrap" }}>
              {fmt(payment.amount)}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button disabled={busy} onClick={() => onApprove(payment.id)} className="btn btn-accent">
              <CheckCircle2 size={14} /> Approve
            </button>
            <button disabled={busy} onClick={() => onReject(payment.id)} className="btn btn-danger">
              <XCircle size={14} /> Reject
            </button>
            <button disabled={busy} onClick={() => onClarify(payment.id)} className="btn btn-outline">
              <AlertTriangle size={14} /> Request Info
            </button>

            {hasEvidence && (
              <button
                onClick={toggleEvidence}
                className="btn btn-outline"
                style={{ marginLeft: "auto", fontSize: 13 }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? "Hide" : "View"} Receipt
                <span style={{
                  marginLeft: 5, background: "var(--color-accent)", color: "#fff",
                  borderRadius: "50%", width: 18, height: 18,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {payment.evidence.length}
                </span>
              </button>
            )}

            {!hasEvidence && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-muted)", fontStyle: "italic" }}>
                No evidence attached
              </span>
            )}
          </div>
        </div>

        {/* Evidence panel */}
        {expanded && (
          <div style={{
            borderTop: "1px solid var(--color-border)",
            padding: 16,
            background: "rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "var(--color-muted)",
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <ImageIcon size={12} /> Payment Evidence / Receipts
            </div>

            {loadingEvidence ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-muted)", fontSize: 13, padding: "8px 0" }}>
                <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                Loading evidence files…
              </div>
            ) : evidenceToShow.length === 0 ? (
              <div style={{ color: "var(--color-muted)", fontSize: 13 }}>No evidence files attached to this payment.</div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: 12,
              }}>
                {evidenceToShow.map((ev) => (
                  <EvidenceTile key={ev.id} ev={ev} onPreview={(src) => setLightboxSrc(src)} />
                ))}
              </div>
            )}

            {!loadingEvidence && evidenceToShow.length > 1 && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: 12 }}
                  onClick={downloadAll}
                >
                  <Download size={13} /> Download All ({evidenceToShow.length} files)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setPayments(null);
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

  if (error) return (
    <div style={{ padding: 24, color: "var(--color-danger)" }}>
      {error}{" "}
      <button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={load}>
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 className="font-display" style={{ fontSize: 22, margin: 0 }}>
          Pending Verifications{payments ? ` (${payments.length})` : ""}
        </h1>
        <button className="btn btn-outline" onClick={load} style={{ fontSize: 13 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {!payments && (
        <div style={{ color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading…
        </div>
      )}

      {payments?.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--color-muted)", borderStyle: "dashed", padding: 36 }}>
          <CheckCircle2 size={32} style={{ marginBottom: 10, opacity: 0.35 }} />
          <div>Nothing waiting for review right now.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {payments?.map((p) => (
          <PaymentCard
            key={p.id}
            payment={p}
            busy={busyId === p.id}
            onApprove={handleApprove}
            onReject={handleReject}
            onClarify={handleClarify}
          />
        ))}
      </div>
    </div>
  );
}
