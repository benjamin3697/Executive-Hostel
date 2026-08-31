import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card" style={{ width: 360, maxWidth: "100%" }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Reset your password</div>

        {submitted ? (
          <>
            <p style={{ fontSize: 14, color: "var(--color-text)", marginBottom: 16 }}>
              If an account exists for that email or phone, a reset link has been generated. Contact the hostel administration if you don't receive it — password reset delivery isn't automated yet.
            </p>
            <Link to="/login" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>Back to login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Email or phone</label>
            <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required style={{ marginBottom: 14 }} />
            {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <Link to="/login" style={{ fontSize: 13, color: "var(--color-muted)", textAlign: "center", display: "block" }}>Back to login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
