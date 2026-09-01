import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

const REGISTRATION_NUMBER_PATTERN = "\\d{10}";

export default function Apply() {
  const [form, setForm] = useState({
    fullName: "", registrationNumber: "", course: "", yearOfStudy: "",
    phone: "", email: "", emergencyContact: "",
    password: "", confirmPassword: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }
    try {
      await api.submitApplication({
        ...form,
        confirmPassword: undefined,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
        termsAccepted,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          <h2 className="font-display" style={{ fontSize: 20 }}>Application received</h2>
          <p style={{ fontSize: 14, color: "var(--color-muted)" }}>
            The hostel administration will review your application and contact you using the details you provided.
          </p>
        </div>
      </div>
    );
  }

  const field = (key: keyof typeof form, label: string, required = true, type = "text", extraProps: Record<string, unknown> = {}) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
      <input className="input" type={type} required={required} value={form[key]} onChange={(e) => set(key, e.target.value)} {...extraProps} />
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <img
        src="/images/hostel-exterior.jpg"
        alt="Executive Hostel"
        style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12, marginBottom: 16 }}
      />
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 4 }}>Apply for Accommodation</h1>
      <p style={{ fontSize: 12.5, color: "var(--color-muted)", marginBottom: 16 }}>
        Executive Hostel is a boys' hostel for male students of Soroti University.
      </p>
      <form onSubmit={handleSubmit} className="card">
        {field("fullName", "Full name")}
        {field("registrationNumber", "University registration number", false, "text", {
          pattern: REGISTRATION_NUMBER_PATTERN,
          maxLength: 10,
          inputMode: "numeric",
          placeholder: "e.g. 2301600084",
          title: "10 digits - the first 2 are your year of entry (e.g. 2301600084 = entered 2023)",
        })}
        {field("course", "Course/Program", false)}
        {field("yearOfStudy", "Year of study", false, "number")}
        {field("phone", "Phone number")}
        {field("email", "Email", false, "email")}
        {field("emergencyContact", "Emergency contact", false)}
        {field("password", "Create password", true, "password")}
        {field("confirmPassword", "Confirm password", true, "password")}

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--color-muted)", marginBottom: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            required
            style={{ marginTop: 2 }}
          />
          <span>
            I have read and agree to the{" "}
            <Link to="/guidelines" target="_blank" style={{ color: "var(--color-primary)" }}>Hostel Rules and Regulations</Link>.
          </span>
        </label>

        {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={submitting || !termsAccepted} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
