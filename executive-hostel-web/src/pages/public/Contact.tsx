import { FormEvent, useEffect, useState } from "react";
import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { api, ContactRow } from "../../lib/api";

export default function Contact() {
  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    api.contacts().then(setContacts).catch(() => setContacts([]));
  }, []);

  const landlady = contacts?.find((contact) => contact.label.toLowerCase().includes("landlady")) ?? contacts?.find((contact) => contact.phone);
  const security = contacts?.find((contact) => contact.label.toLowerCase().includes("security"));
  const whatsappPhone = (landlady?.phone ?? "").replace(/\D/g, "");
  function submitInquiry(event: FormEvent) {
    event.preventDefault();
    window.location.href = `mailto:${landlady?.email ?? ""}?subject=Executive Hostel enquiry&body=${encodeURIComponent(`Reply to: ${email}\n\n${message}`)}`;
  }

  return (
    <div className="page-container contact-hub">
      <div className="page-header"><div><div className="eyebrow">Executive Hostel</div><h1>Contact us</h1><p>Reach the right person quickly for accommodation, security, or general enquiries.</p></div></div>
      {!contacts && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      <div className="contact-action-grid">
        {landlady?.phone && <a className="contact-action" href={`tel:${landlady.phone}`}><Phone size={18} /><span>Call {landlady.label}</span></a>}
        {security?.phone && <a className="contact-action" href={`tel:${security.phone}`}><Phone size={18} /><span>Call security desk</span></a>}
        {whatsappPhone && <a className="contact-action" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsappPhone}`}><MessageCircle size={18} /><span>Chat on WhatsApp</span></a>}
        {landlady?.email && <a className="contact-action" href={`mailto:${landlady.email}`}><Mail size={18} /><span>Email management</span></a>}
      </div>
      {contacts?.length === 0 && <div className="card" style={{ color: "var(--color-muted)" }}>Direct contacts are being configured. You can still send an enquiry below or find us in Soroti.</div>}
      <div className="card contact-map"><iframe title="Executive Hostel location in Soroti" loading="lazy" src="https://www.google.com/maps?q=Soroti%20University%2C%20Uganda&output=embed" /></div>
      <form className="card" onSubmit={submitInquiry}>
        <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>Send an enquiry</h2><p style={{ margin: "0 0 14px", color: "var(--color-muted)", fontSize: 12 }}>Ask about rooms, fees, applications, or visiting.</p>
        <div className="field" style={{ marginBottom: 10 }}><label htmlFor="contact-email">Your email</label><input id="contact-email" className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="field" style={{ marginBottom: 12 }}><label htmlFor="contact-message">Message</label><textarea id="contact-message" className="input" rows={4} required value={message} onChange={(event) => setMessage(event.target.value)} /></div>
        <button className="btn btn-primary" type="submit"><Send size={15} /> Send enquiry</button>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {contacts?.map((c) => (
          <div key={c.id} className="card">
            <strong style={{ fontSize: 14 }}>{c.label}</strong>
            {c.phone && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <Phone size={14} color="var(--color-primary)" />
                <a href={`tel:${c.phone}`} style={{ fontSize: 13, color: "var(--color-text)" }}>{c.phone}</a>
              </div>
            )}
            {c.email && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <Mail size={14} color="var(--color-primary)" />
                <a href={`mailto:${c.email}`} style={{ fontSize: 13, color: "var(--color-text)" }}>{c.email}</a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
