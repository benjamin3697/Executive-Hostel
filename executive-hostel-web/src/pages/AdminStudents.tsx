import { useEffect, useState, useCallback, useMemo } from "react";
import { X, Download } from "lucide-react";
import { api, StudentRow, StudentDetail, SemesterRow, Room, ApiError } from "../lib/api";
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

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  fully_paid: "Fully Paid",
  partially_paid: "Partially Paid",
  outstanding: "Outstanding",
  no_active_accommodation: "No Room Yet",
};

function downloadCsv(rows: StudentRow[]) {
  const headers = ["Name", "Registration Number", "Section", "Room", "Room Type", "Course", "Year", "Semester", "Fee", "Paid", "Balance", "Payment Status", "Residency Status"];
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.join(",")];
  for (const s of rows) {
    lines.push([
      s.fullName, s.registrationNumber,
      s.currentRoom?.section.name ?? "", s.currentRoom?.roomNumber ?? "", s.currentRoom?.roomType.name ?? "",
      s.course ?? "", s.yearOfStudy?.toString() ?? "",
      s.semester ? `${s.semester.academicYear.label} ${s.semester.label}` : "",
      s.payment.fee?.toString() ?? "", s.payment.verifiedPaid.toString(), s.payment.balance?.toString() ?? "",
      PAYMENT_STATUS_LABEL[s.payment.status] ?? s.payment.status, s.status,
    ].map(escape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const [roomType, setRoomType] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [course, setCourse] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const load = useCallback(() => {
    api.students({
      q: q || undefined, section: section || undefined, roomType: roomType || undefined,
      status: status || undefined, year: year ? Number(year) : undefined, course: course || undefined,
      semesterId: semesterId || undefined, paymentStatus: paymentStatus || undefined,
    })
      .then((r) => { setStudents(r.students); setTotal(r.total); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }, [q, section, roomType, status, year, course, semesterId, paymentStatus]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce - avoids firing a request per keystroke
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { api.rooms({}).then(setRooms).catch(() => {}); }, []);
  useEffect(() => { api.semesters().then(setSemesters).catch(() => {}); }, []);

  const sections = useMemo(() => Array.from(new Set(rooms.map((r) => r.section.name))), [rooms]);
  const roomTypes = useMemo(() => Array.from(new Set(rooms.map((r) => r.roomType.name))), [rooms]);
  const courses = useMemo(() => Array.from(new Set(students?.map((s) => s.course).filter((c): c is string => !!c) ?? [])), [students]);

  const anyFilterActive = q || section || roomType || status || year || course || semesterId || paymentStatus;
  function clearFilters() {
    setQ(""); setSection(""); setRoomType(""); setStatus(""); setYear(""); setCourse(""); setSemesterId(""); setPaymentStatus("");
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <h1 className="font-display" style={{ fontSize: 22 }}>Students {total ? `(${total})` : ""}</h1>
        <button onClick={() => students && downloadCsv(students)} disabled={!students?.length} className="btn btn-outline">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
        <input className="input" placeholder="Search name/reg no./phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
          <option value="">All room types</option>
          {roomTypes.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="applicant">Applicant</option>
          <option value="active">Active</option>
          <option value="checked_out">Checked Out</option>
          <option value="suspended">Suspended</option>
        </select>
        <input className="input" placeholder="Year (e.g. 2)" value={year} onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, ""))} />
        <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
          <option value="">All semesters</option>
          {semesters.map((s) => <option key={s.id} value={s.id}>{s.academicYear?.label} — {s.label}{s.type === "recess" ? " (Recess)" : ""}</option>)}
        </select>
        <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">Any payment status</option>
          <option value="fully_paid">Fully Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="outstanding">Outstanding</option>
          <option value="no_active_accommodation">No Room Yet</option>
        </select>
        {anyFilterActive ? (
          <button onClick={clearFilters} className="btn btn-outline" style={{ fontSize: 12.5 }}>Clear filters</button>
        ) : null}
      </div>

      {!students && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {students?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No students match these filters.</div>}

      {students && students.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "var(--color-bg)", textAlign: "left" }}>
                {["Name", "Reg. No.", "Room", "Course", "Year", "Semester", "Fee", "Paid", "Balance", "Payment", "Status"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "var(--color-muted)", whiteSpace: "nowrap", borderBottom: "1px solid var(--color-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--color-border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{s.fullName}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{s.registrationNumber}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{s.currentRoom ? `${s.currentRoom.section.name} ${s.currentRoom.roomNumber}` : "—"}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{s.course ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{s.yearOfStudy ?? "—"}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{s.semester ? `${s.semester.label}${s.semester.type === "recess" ? " (R)" : ""}` : "—"}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(s.payment.fee)}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(s.payment.verifiedPaid)}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 600, color: s.payment.balance ? "var(--color-danger)" : "var(--color-accent)" }}>{fmt(s.payment.balance)}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={s.payment.status} label={PAYMENT_STATUS_LABEL[s.payment.status] ?? s.payment.status} /></td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={s.status} label={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <StudentDetailModal studentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
