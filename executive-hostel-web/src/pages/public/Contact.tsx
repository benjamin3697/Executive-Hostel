import { useEffect, useState } from "react";
import { Phone, Mail } from "lucide-react";
import { api, ContactRow } from "../../lib/api";

export default function Contact() {
  const [contacts, setContacts] = useState<ContactRow[] | null>(null);

  useEffect(() => {
    api.contacts().then(setContacts).catch(() => setContacts([]));
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 16 }}>Contact Us</h1>
      {!contacts && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {contacts?.length === 0 && <div className="card" style={{ color: "var(--color-muted)" }}>Contact details haven't been configured yet — check back soon.</div>}
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
