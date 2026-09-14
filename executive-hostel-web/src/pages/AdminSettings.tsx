import { useEffect, useState, FormEvent } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { api, ContactRow, AcademicYearRow, SemesterRow, FeeRow, ApiError } from "../lib/api";

const PAYMENT_KEYS = [
  { key: "bank_name", label: "Bank Name" },
  { key: "bank_account_name", label: "Account Name" },
  { key: "bank_account_number", label: "Account Number" },
  { key: "bank_branch", label: "Branch" },
  { key: "mobile_money_number", label: "Mobile Money Number" },
  { key: "payment_instructions", label: "Payment Instructions" },
  { key: "payment_deadline", label: "Payment Deadline" },
];

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([]);
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [roomTypes, setRoomTypes] = useState<{ roomType: string; roomTypeId: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactLabel, setContactLabel] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");


  const [newYearLabel, setNewYearLabel] = useState("");
  const [newSemesterYearId, setNewSemesterYearId] = useState("");
  const [newSemesterLabel, setNewSemesterLabel] = useState("");
  const [newSemesterType, setNewSemesterType] = useState<"regular" | "recess">("regular");

  const [newFeeRoomTypeId, setNewFeeRoomTypeId] = useState("");
  const [newFeeAmount, setNewFeeAmount] = useState("");
  const [newFeeSemesterId, setNewFeeSemesterId] = useState("");

  function loadAll() {
    api.allSettings().then((rows) => {
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value ?? "";
      setValues(map);
    }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load settings."));
    api.contacts().then(setContacts).catch(() => {});
    api.academicYears().then(setAcademicYears).catch(() => {});
    api.semesters().then(setSemesters).catch(() => {});
    api.feeHistory().then(setFees).catch(() => {});
    api.currentFees().then((rows) => setRoomTypes(rows.map((r) => ({ roomType: r.roomType, roomTypeId: r.roomTypeId })))).catch(() => {});
  }
  useEffect(loadAll, []);

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings(PAYMENT_KEYS.map(({ key }) => ({ key, value: values[key] || null })));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    await api.createContact({ label: contactLabel, phone: contactPhone || undefined, email: contactEmail || undefined });
    setContactLabel(""); setContactPhone(""); setContactEmail("");
    api.contacts().then(setContacts);
  }

  async function handleAddYear(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createAcademicYear(newYearLabel);
      setNewYearLabel("");
      api.academicYears().then(setAcademicYears);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to create academic year.");
    }
  }

  async function handleAddSemester(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createSemester({ academicYearId: newSemesterYearId, label: newSemesterLabel, type: newSemesterType });
      setNewSemesterLabel("");
      api.semesters().then(setSemesters);
      api.academicYears().then(setAcademicYears);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to create semester.");
    }
  }

  async function handleEditYear(year: AcademicYearRow) {
    const label = window.prompt("Academic year label", year.label)?.trim();
    if (!label || label === year.label) return;
    try { await api.updateAcademicYear(year.id, label); loadAll(); } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to update academic year."); }
  }

  async function handleDeleteYear(year: AcademicYearRow) {
    if (!window.confirm(`Delete academic year ${year.label}?`)) return;
    try { await api.deleteAcademicYear(year.id); loadAll(); } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to delete academic year."); }
  }

  async function handleEditSemester(semester: SemesterRow) {
    const label = window.prompt("Semester label", semester.label)?.trim();
    if (!label || label === semester.label) return;
    try { await api.updateSemester(semester.id, { label }); loadAll(); } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to update semester."); }
  }

  async function handleDeleteSemester(semester: SemesterRow) {
    if (!window.confirm(`Delete ${semester.academicYear?.label ?? "this year"} — ${semester.label}?`)) return;
    try { await api.deleteSemester(semester.id); loadAll(); } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to delete semester."); }
  }

  async function handleAddFee(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createFee({
        roomTypeId: newFeeRoomTypeId,
        amount: Number(newFeeAmount),
        semesterId: newFeeSemesterId || undefined,
      });
      setNewFeeAmount("");
      api.feeHistory().then(setFees);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to create fee.");
    }
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div className="page-container settings-page">
      <div className="page-header"><div><div className="eyebrow">Administration</div><h1>Settings</h1><p>Keep payment details, contacts, academic periods, and accommodation fees organized.</p></div></div>

      <details className="card settings-section" open><summary><span>Payment information</span><ChevronDown size={17} /></summary><form onSubmit={handleSaveSettings}>
        {PAYMENT_KEYS.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
            <input
              className="input"
              value={values[key] ?? ""}
              inputMode={key === "payment_deadline" ? "numeric" : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </div>
        ))}
        {saved && <div style={{ color: "var(--color-accent)", fontSize: 13, marginBottom: 12 }}>Saved.</div>}
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving..." : "Save Payment Info"}</button>
      </form></details>

      <details className="card settings-section" open><summary><span>Contacts</span><ChevronDown size={17} /></summary><div className="settings-section-body">
      <div className="card" style={{ marginBottom: 12 }}>
        {contacts?.map((c) => (
          <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
            <strong>{c.label}</strong> — {c.phone} {c.email && `· ${c.email}`}
          </div>
        ))}
        {contacts?.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No contacts configured yet.</div>}
      </div>
      <form onSubmit={handleAddContact} className="card" style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="input" placeholder="Label (e.g. Landlady)" required value={contactLabel} onChange={(e) => setContactLabel(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input className="input" placeholder="Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input className="input" placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ flex: "1 1 140px" }} />
        <button type="submit" className="btn btn-outline">Add Contact</button>
      </form>
      </div></details>

      <details className="card settings-section" open><summary><span>Academic calendar</span><ChevronDown size={17} /></summary><div className="settings-section-body">
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
        Create an academic year, then the semesters within it (2 regular + a recess semester, or however your calendar is structured). Enroll students into a semester from their profile on the Students page — that's what determines which fee and which payments count toward their current balance.
      </p>
      <div className="card" style={{ marginBottom: 12 }}>
        {academicYears.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No academic years yet.</div>}
        {academicYears.map((y) => (
          <div key={y.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{y.label}</strong>
              <span style={{ display: "flex", gap: 5 }}>
                <button type="button" className="icon-button" title="Edit academic year" aria-label="Edit academic year" onClick={() => handleEditYear(y)}><Pencil size={14} /></button>
                <button type="button" className="icon-button icon-button-danger" title="Delete academic year" aria-label="Delete academic year" onClick={() => handleDeleteYear(y)}><Trash2 size={14} /></button>
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
              {y.semesters.length === 0 ? "No semesters yet" : y.semesters.map((s) => (
                <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10 }}>
                  {`${s.label}${s.type === "recess" ? " (Recess)" : ""}`}
                  <button type="button" className="icon-button" title="Edit semester" aria-label="Edit semester" onClick={() => handleEditSemester(s)}><Pencil size={11} /></button>
                  <button type="button" className="icon-button icon-button-danger" title="Delete semester" aria-label="Delete semester" onClick={() => handleDeleteSemester(s)}><Trash2 size={11} /></button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddYear} className="card" style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input className="input" placeholder="e.g. 2025/2026" required value={newYearLabel} onChange={(e) => setNewYearLabel(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn btn-outline">Add Academic Year</button>
      </form>
      <form onSubmit={handleAddSemester} className="card" style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="input" required value={newSemesterYearId} onChange={(e) => setNewSemesterYearId(e.target.value)} style={{ flex: "1 1 140px" }}>
          <option value="">Academic year...</option>
          {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
        </select>
        <input className="input" placeholder="Label (e.g. Semester 1)" required value={newSemesterLabel} onChange={(e) => setNewSemesterLabel(e.target.value)} style={{ flex: "1 1 140px" }} />
        <select className="input" value={newSemesterType} onChange={(e) => setNewSemesterType(e.target.value as "regular" | "recess")} style={{ flex: "0 1 120px" }}>
          <option value="regular">Regular</option>
          <option value="recess">Recess</option>
        </select>
        <button type="submit" className="btn btn-outline">Add Semester</button>
      </form>
      </div></details>

      <details className="card settings-section" open><summary><span>Accommodation fees</span><ChevronDown size={17} /></summary><div className="settings-section-body">
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
        Leaving "Semester" blank sets the default fee for that room type (used whenever no semester-specific fee exists — e.g. recess residents are charged the default until you add a recess-specific fee here).
      </p>
      <div className="card" style={{ marginBottom: 12 }}>
        {fees.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No fees configured yet.</div>}
        {fees.map((f) => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
            <span>{f.roomType.name} {f.semester ? `— ${f.semester.label}` : "(default)"}</span>
            <strong>UGX {f.amount.toLocaleString("en-UG")}</strong>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddFee} className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="input" required value={newFeeRoomTypeId} onChange={(e) => setNewFeeRoomTypeId(e.target.value)} style={{ flex: "1 1 160px" }}>
          <option value="">Room type...</option>
          {roomTypes.map((rt) => <option key={rt.roomTypeId} value={rt.roomTypeId}>{rt.roomType}</option>)}
        </select>
        <select className="input" value={newFeeSemesterId} onChange={(e) => setNewFeeSemesterId(e.target.value)} style={{ flex: "1 1 160px" }}>
          <option value="">Default (no specific semester)</option>
          {semesters.map((s) => <option key={s.id} value={s.id}>{s.academicYear?.label} — {s.label}{s.type === "recess" ? " (Recess)" : ""}</option>)}
        </select>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="Amount (UGX)"
          required
          value={newFeeAmount}
          onChange={(e) => setNewFeeAmount(e.target.value.replace(/[^\d]/g, ""))}
          style={{ flex: "1 1 140px" }}
        />
        <button type="submit" className="btn btn-outline">Add Fee</button>
      </form>
      </div></details>
    </div>
  );
}
