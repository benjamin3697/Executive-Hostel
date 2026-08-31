import { useEffect, useState, FormEvent } from "react";
import { api, ContactRow, GuidelineRow, AcademicYearRow, SemesterRow, FeeRow, ApiError } from "../lib/api";

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
  const [guidelines, setGuidelines] = useState<GuidelineRow[] | null>(null);
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

  const [guidelineCategory, setGuidelineCategory] = useState("");
  const [guidelineContent, setGuidelineContent] = useState("");

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
    api.guidelines().then(setGuidelines).catch(() => {});
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

  async function handleAddGuideline(e: FormEvent) {
    e.preventDefault();
    await api.createGuideline({ category: guidelineCategory, content: guidelineContent });
    setGuidelineCategory(""); setGuidelineContent("");
    api.guidelines().then(setGuidelines);
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
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Settings</h1>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10 }}>PAYMENT INFORMATION</h2>
      <form onSubmit={handleSaveSettings} className="card" style={{ marginBottom: 24 }}>
        {PAYMENT_KEYS.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
            <input
              className="input"
              value={values[key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </div>
        ))}
        {saved && <div style={{ color: "var(--color-accent)", fontSize: 13, marginBottom: 12 }}>Saved.</div>}
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving..." : "Save Payment Info"}</button>
      </form>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10 }}>CONTACTS</h2>
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

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10 }}>HOSTEL GUIDELINES</h2>
      <div style={{ marginBottom: 12 }}>
        {guidelines?.map((g) => (
          <div key={g.id} className="card" style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{g.category}</strong>
            <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "4px 0 0" }}>{g.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddGuideline} className="card">
        <input className="input" placeholder="Category (e.g. Quiet Hours)" required value={guidelineCategory} onChange={(e) => setGuidelineCategory(e.target.value)} style={{ marginBottom: 8 }} />
        <textarea className="input" placeholder="Content" required rows={3} value={guidelineContent} onChange={(e) => setGuidelineContent(e.target.value)} style={{ marginBottom: 8 }} />
        <button type="submit" className="btn btn-outline">Add Guideline</button>
      </form>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginTop: 24, marginBottom: 10 }}>ACADEMIC CALENDAR</h2>
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
        Create an academic year, then the semesters within it (2 regular + a recess semester, or however your calendar is structured). Enroll students into a semester from their profile on the Students page — that's what determines which fee and which payments count toward their current balance.
      </p>
      <div className="card" style={{ marginBottom: 12 }}>
        {academicYears.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No academic years yet.</div>}
        {academicYears.map((y) => (
          <div key={y.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
            <strong style={{ fontSize: 13 }}>{y.label}</strong>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
              {y.semesters.length === 0 ? "No semesters yet" : y.semesters.map((s) => `${s.label}${s.type === "recess" ? " (Recess)" : ""}`).join(", ")}
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

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10 }}>ACCOMMODATION FEES</h2>
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
        Leaving "Semester" blank sets the default fee for that room type (used whenever no semester-specific fee exists — e.g. recess residents are charged the default until you add a recess-specific fee here).
      </p>
      <div className="card" style={{ marginBottom: 12 }}>
        {fees.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No fees configured yet.</div>}
        {fees.map((f) => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
            <span>{f.roomType.name} {f.semester ? `— ${f.semester.label}` : "(default)"}</span>
            <strong>UGX {f.amount.toLocaleString()}</strong>
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
    </div>
  );
}
