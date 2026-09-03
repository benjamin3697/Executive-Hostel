import { useEffect, useState } from "react";
import { BookOpen, List, Printer } from "lucide-react";
import { api, GuidelineRow } from "../../lib/api";

export default function Guidelines() {
  const [guidelines, setGuidelines] = useState<GuidelineRow[] | null>(null);

  useEffect(() => {
    api.guidelines().then(setGuidelines).catch(() => setGuidelines([]));
  }, []);

  return (
    <main className="rules-page">
      <header className="rules-hero">
        <div className="rules-eyebrow"><BookOpen size={16} /> Executive Hostel</div>
        <h1 className="font-display">Rules and Regulations</h1>
        <p>Our shared standard for a safe, respectful and well-managed residence.</p>
        <button className="btn btn-outline rules-print" onClick={() => window.print()}><Printer size={15} /> Print rules</button>
      </header>
      {!guidelines && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {guidelines?.length === 0 && <div className="card" style={{ color: "var(--color-muted)" }}>Rules are currently unavailable.</div>}
      {!!guidelines?.length && <div className="rules-layout">
        <aside className="rules-contents card">
          <div className="rules-contents-title"><List size={16} /> Contents</div>
          {guidelines.map((g, index) => <a key={g.id} href={`#rule-${g.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{g.category}</a>)}
        </aside>
        <div className="rules-document">
        {guidelines?.map((g) => (
          <section key={g.id} id={`rule-${g.id}`} className="rules-section">
            <div className="rules-section-number">§</div>
            <div>
              <h2 className="font-display">{g.category}</h2>
              <p>{g.content}</p>
            </div>
          </section>
        ))}
        </div>
      </div>}
      <footer className="rules-footer">
        <span>Executive Hostel · Soroti University</span>
        <span>Please keep these rules in mind throughout your stay.</span>
      </footer>
    </main>
  );
}
