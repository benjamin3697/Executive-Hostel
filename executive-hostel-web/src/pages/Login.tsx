import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password, rememberMe);
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

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Email or phone number</label>
        <input
          className="input"
          type="text"
          inputMode="email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com or 07..."
          autoComplete="username"
          required
          style={{ marginBottom: 14 }}
        />

        <label htmlFor="login-password" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Password</label>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <input
            id="login-password"
            className="input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", display: "grid", placeItems: "center", width: 32, height: 32, padding: 0, border: 0, background: "transparent", color: "var(--color-muted)", cursor: "pointer" }}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        <Link to="/forgot-password" style={{ fontSize: 12.5, color: "var(--color-primary)", display: "block", marginBottom: 16 }}>
          Forgot password?
        </Link>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Keep me signed in on this device
        </label>

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
