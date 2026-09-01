import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <div
        style={{
          position: "relative",
          padding: "88px 24px",
          textAlign: "center",
          color: "#fff",
          backgroundImage: "linear-gradient(rgba(155,74,40,0.82), rgba(51,40,33,0.88)), url(/images/hostel-exterior.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center 35%",
        }}
      >
        <h1 className="font-display" style={{ fontSize: 36, marginBottom: 8, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>EXECUTIVE HOSTEL</h1>
        <p style={{ fontSize: 18, marginBottom: 4 }}>Comfortable Student Accommodation in Soroti</p>
        <p style={{ fontSize: 14, opacity: 0.92, marginBottom: 24 }}>Reliable and convenient accommodation for male students of Soroti University.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/rooms" className="btn" style={{ background: "#fff", color: "var(--color-primary-dark)" }}>View Available Rooms</Link>
          <Link to="/apply" className="btn" style={{ background: "var(--color-primary-dark)", color: "#fff" }}>Apply for Accommodation</Link>
          <Link to="/login" className="btn btn-outline" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>Student Login</Link>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 32px 0" }}>
        <img
          src="/images/hostel-walkway.jpg"
          alt="Executive Hostel courtyard and room walkway"
          style={{ width: "100%", maxHeight: 340, objectFit: "cover", borderRadius: 12, boxShadow: "0 4px 16px rgba(51,40,33,0.15)" }}
        />
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", textAlign: "center", marginTop: 8 }}>
          The compound and room walkway at Executive Main
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="card">
          <h3 className="font-display" style={{ fontSize: 17, marginBottom: 6 }}>Executive Main</h3>
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>52 single rooms — Rooms 01–40 Non-Self-Contained, 41–52 Self-Contained.</p>
        </div>
        <div className="card">
          <h3 className="font-display" style={{ fontSize: 17, marginBottom: 6 }}>Executive Annex</h3>
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>20 single rooms — all Self-Contained.</p>
        </div>
        <div className="card">
          <h3 className="font-display" style={{ fontSize: 17, marginBottom: 6 }}>Single Rooms Only</h3>
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Every room houses one resident — no shared rooms, ever.</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px 40px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        <Link to="/guidelines" style={{ color: "var(--color-primary)" }}>Hostel Guidelines</Link>
        <Link to="/contact" style={{ color: "var(--color-primary)" }}>Contact Us</Link>
      </div>
    </div>
  );
}
