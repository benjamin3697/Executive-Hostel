import { useState, FormEvent } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.confirmPasswordReset(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card" style={{ width: 360, maxWidth: "100%", textAlign: "center" }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>This reset link is missing its token.</p>
          <Link to="/forgot-password" className="btn btn-primary">Request a new link</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card" style={{ width: 360, maxWidth: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Password updated. All previous sessions have been signed out for security.</p>
          <button onClick={() => navigate("/login")} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Log in</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, maxWidth: "100%" }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Set a new password</div>

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>New password</label>
        <input className="input" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ marginBottom: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Confirm new password</label>
        <input className="input" type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ marginBottom: 14 }} />

        {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
