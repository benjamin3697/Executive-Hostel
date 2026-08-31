import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { api, StudentRow, StudentDetail, SemesterRow, ApiError } from "../lib/api";
import { StatusBadge, fmt } from "../lib/format";

function StudentDetailModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(() => {
    api.student(studentId).then(setDetail).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, [studentId]);
  useEffect(load, [load]);
  useEffect(() => { api.semesters().then(setSemesters).catch(() => {}); }, []);

  async function handleCorrect(paymentId: string, currentAmount: number) {
    const reason = prompt("Reason for this correction (required, shown to the student):");
    if (!reason) return;
    const newAmountStr = prompt(`New amount (currently UGX ${currentAmount.toLocaleString()}):`, String(currentAmount));
    if (!newAmountStr) return;
    const newAmount = Number(newAmountStr);
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      alert("Enter a valid positive amount.");
      return;
    }
    setBusyPaymentId(paymentId);
    try {
      await api.correctPayment(paymentId, reason, newAmount);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to correct payment.");
    } finally {
      setBusyPaymentId(null);
    }
  }

  async function handleEnroll() {
    if (!selectedSemesterId) return;
    setEnrolling(true);
    try {
      await api.enrollStudent(studentId, selectedSemesterId);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to enroll.");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(51,40,33,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div className="card" style={{ width: 520, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>{detail?.fullName ?? "Loading..."}</strong>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        {error && <div style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</div>}
        {!detail && !error && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}

        {detail && (
          <>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", marginBottom: 4 }}>
              {detail.registrationNumber} {detail.course && `· ${detail.course}`} {detail.yearOfStudy && `· Year ${detail.yearOfStudy}`}
              {detail.currentRoom && ` · ${detail.currentRoom.section.name} Room ${detail.currentRoom.roomNumber}`}
              {detail.phone && ` · ${detail.phone}`} {detail.email && ` · ${detail.email}`}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 16 }}>
              Rules agreed: {detail.termsAcceptedAt ? `Yes (${new Date(detail.termsAcceptedAt).toLocaleDateString()})` : "Not yet"}
            </div>

            <div className="card" style={{ marginBottom: 16, background: "var(--color-primary-soft)", border: "none" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>SEMESTER ENROLLMENT</div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                Current: {detail.semester
                  ? `${detail.semester.academicYear.label} — ${detail.semester.label}${detail.semester.type === "recess" ? " (Recess)" : ""}`
                  : <span style={{ color: "var(--color-muted)" }}>Not enrolled in a semester yet</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select className="input" value={selectedSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
                  <option value="">Select a semester...</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.academicYear?.label} — {s.label}{s.type === "recess" ? " (Recess)" : ""}
                    </option>
                  ))}
                </select>
                <button disabled={!selectedSemesterId || enrolling} onClick={handleEnroll} className="btn btn-primary" style={{ fontSize: 12.5 }}>
                  {enrolling ? "Enrolling..." : "Enroll"}
                </button>
              </div>
              {semesters.length === 0 && (
                <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 8 }}>
                  No semesters configured yet - create one under Settings → Academic Calendar.
                </div>
              )}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8 }}>PAYMENT HISTORY</div>
            {detail.payments.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No payments submitted yet.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.payments.map((p) => (
                <div key={p.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{fmt(p.amount)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
                    {p.paymentMethod} · {new Date(p.paymentDate).toLocaleDateString()}
                  </div>
                  {p.status === "verified" && (
                    <button
                      disabled={busyPaymentId === p.id}
                      onClick={() => handleCorrect(p.id, p.amount)}
                      className="btn btn-outline"
                      style={{ marginTop: 8, fontSize: 11.5, padding: "5px 10px" }}
                    >
                      {busyPaymentId === p.id ? "Correcting..." : "Correct this payment"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.students({ q: q || undefined })
      .then((r) => { setStudents(r.students); setTotal(r.total); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Students {total ? `(${total})` : ""}</h1>
      <input
        className="input"
        placeholder="Search by name, registration number, or phone..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
      />

      {!students && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {students?.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, width: "100%", textAlign: "left", cursor: "pointer" }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.fullName}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                {s.registrationNumber} {s.course && `· ${s.course}`} {s.yearOfStudy && `· Year ${s.yearOfStudy}`}
                {s.currentRoom && ` · ${s.currentRoom.section.name} Room ${s.currentRoom.roomNumber}`}
              </div>
            </div>
            <StatusBadge status={s.status} label={s.status} />
          </button>
        ))}
        {students?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No students found.</div>}
      </div>

      {selectedId && <StudentDetailModal studentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
