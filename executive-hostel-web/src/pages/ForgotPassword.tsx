import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { AuthLayout } from "../components/SiteUI";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.requestPasswordReset(identifier);
      setSubmitted(true); // shown regardless of whether the account exists
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Use the email address or phone number linked to your approved hostel account.">

        {submitted ? (
          <>
            <p style={{ fontSize: 14, color: "var(--color-text)", marginBottom: 16 }}>
              If an active account matches those details, a password reset link has been sent to the email address or phone number on file. The link expires in one hour.
            </p>
            <Link to="/login" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>Back to login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Email or phone number</label>
            <input className="input" type="text" inputMode="email" autoComplete="username" placeholder="you@example.com or 07..." value={identifier} onChange={(e) => setIdentifier(e.target.value)} required style={{ marginBottom: 14 }} />
            {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <Link to="/login" style={{ fontSize: 13, color: "var(--color-muted)", textAlign: "center", display: "block" }}>Back to login</Link>
          </form>
        )}
    </AuthLayout>
  );
}
