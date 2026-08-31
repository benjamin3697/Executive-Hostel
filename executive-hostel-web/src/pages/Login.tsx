import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        // ACCOUNT_LOCKED (423) and INVALID_CREDENTIALS (401) both come
        // through here with a message that's already safe to show directly.
        setError(err.message);
      } else {
        setError("Could not reach the server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, maxWidth: "100%" }}>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary-dark)", marginBottom: 4 }}>
          Executive Hostel
        </div>
        <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20 }}>Soroti University</div>

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Email or phone</label>
        <input
          className="input"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          required
          style={{ marginBottom: 14 }}
        />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={{ marginBottom: 8 }}
        />
        <Link to="/forgot-password" style={{ fontSize: 12.5, color: "var(--color-primary)", display: "block", marginBottom: 16 }}>
          Forgot password?
        </Link>

        {error && (
          <div style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
