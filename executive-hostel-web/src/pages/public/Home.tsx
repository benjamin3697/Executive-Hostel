import { Link } from "react-router-dom";
import { Camera, Droplets, Fence, ShieldCheck, Tv, Wifi, Zap } from "lucide-react";

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
        <p style={{ fontSize: 18, marginBottom: 4 }}>Your Home Away From Home at Soroti University</p>
        <p style={{ fontSize: 14, opacity: 0.92, margin: "0 auto 24px", maxWidth: 560 }}>A comfortable, secure, and convenient place to live, study, and connect with fellow male students just minutes from campus.</p>
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

      <section className="home-section home-features">
        <div className="home-section-heading">
          <span className="eyebrow">Made for student life</span>
          <h2>Everything you need for a comfortable stay</h2>
          <p>Practical amenities and a well-managed environment help you focus on your studies and enjoy hostel life.</p>
        </div>
        <div className="home-feature-grid">
          <div className="home-feature"><Wifi aria-hidden="true" /><div><h3>Free Wi-Fi</h3><p>Stay connected for research, online learning, communication, and everyday browsing.</p></div></div>
          <div className="home-feature"><Tv aria-hidden="true" /><div><h3>DStv entertainment</h3><p>Relax and keep up with sports, news, and movies in your free time.</p></div></div>
          <div className="home-feature"><Droplets aria-hidden="true" /><div><h3>Water available 24/7</h3><p>Enjoy a dependable water supply supported by reserve storage.</p></div></div>
          <div className="home-feature"><Zap aria-hidden="true" /><div><h3>Power for daily essentials</h3><p>Electricity is available for study and everyday needs, with occasional interruptions possible.</p></div></div>
        </div>
      </section>

      <section className="home-section home-security">
        <div className="home-section-heading">
          <span className="eyebrow">Peace of mind</span>
          <h2>A secure place to call home</h2>
          <p>Security is taken seriously, from the perimeter to the shared spaces where residents live and move every day.</p>
        </div>
        <div className="home-security-grid">
          <div><ShieldCheck aria-hidden="true" /><strong>Strong security</strong><span>A managed environment with tight security.</span></div>
          <div><Camera aria-hidden="true" /><strong>CCTV monitoring</strong><span>Security cameras cover key entry and common areas.</span></div>
          <div><Fence aria-hidden="true" /><strong>Well-fenced compound</strong><span>Controlled access within a clearly secured perimeter.</span></div>
        </div>
      </section>

      <section className="home-portal-callout">
        <div><span className="eyebrow">Simple hostel management</span><h2>Manage your stay online</h2><p>Check availability, apply for accommodation, follow your payment status, and submit maintenance requests through the portal.</p></div>
        <Link to="/apply" className="btn btn-primary">Secure your room</Link>
      </section>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px 40px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        <Link to="/guidelines" style={{ color: "var(--color-primary)" }}>Hostel Guidelines</Link>
        <Link to="/contact" style={{ color: "var(--color-primary)" }}>Contact Us</Link>
      </div>
    </div>
  );
}
