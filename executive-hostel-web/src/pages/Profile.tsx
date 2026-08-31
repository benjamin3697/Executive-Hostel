import { useEffect, useState, FormEvent } from "react";
import { api, Me, ApiError } from "../lib/api";

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [homeDistrict, setHomeDistrict] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  useEffect(() => {
    api.me().then((data) => {
      setMe(data);
      const s = data.student;
      if (s) {
        setPhone(s.phone ?? "");
        setEmail(s.email ?? "");
        setCourse(s.course ?? "");
        setYearOfStudy(s.yearOfStudy ? String(s.yearOfStudy) : "");
        setHomeDistrict(s.homeDistrict ?? "");
        setEmergencyName(s.emergencyContactName ?? "");
        setEmergencyPhone(s.emergencyContactPhone ?? "");
      }
    }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load profile."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateProfile({
        phone: phone || undefined,
        email: email || undefined,
        course: course || undefined,
        yearOfStudy: yearOfStudy ? Number(yearOfStudy) : undefined,
        homeDistrict: homeDistrict || undefined,
        emergencyContactName: emergencyName || undefined,
        emergencyContactPhone: emergencyPhone || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;
  if (!me) return <div style={{ padding: 24, color: "var(--color-muted)" }}>Loading...</div>;

  const field = (label: string, value: string, setter: (v: string) => void, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
      <input className="input" type={type} value={value} onChange={(e) => setter(e.target.value)} />
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 4 }}>{me.student?.fullName}</h1>
      <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20 }}>
        Reg No. {me.student?.registrationNumber}
        {me.student?.currentRoom && ` · ${me.student.currentRoom.section.name} Room ${me.student.currentRoom.roomNumber}`}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
        Room, fees, and payment status are managed by hostel staff — only the fields below are yours to edit.
      </div>

      <form onSubmit={handleSubmit} className="card">
        {field("Phone", phone, setPhone)}
        {field("Email", email, setEmail, "email")}
        {field("Course", course, setCourse)}
        {field("Year of study", yearOfStudy, setYearOfStudy, "number")}
        {field("Home district", homeDistrict, setHomeDistrict)}
        {field("Emergency contact name", emergencyName, setEmergencyName)}
        {field("Emergency contact phone", emergencyPhone, setEmergencyPhone)}

        {saved && <div style={{ color: "var(--color-accent)", fontSize: 13, marginBottom: 12 }}>Saved.</div>}
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
