import { useEffect, useState } from "react";
import { api, GuidelineRow } from "../../lib/api";

export default function Guidelines() {
  const [guidelines, setGuidelines] = useState<GuidelineRow[] | null>(null);

  useEffect(() => {
    api.guidelines().then(setGuidelines).catch(() => setGuidelines([]));
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 16 }}>Hostel Guidelines</h1>
      {!guidelines && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {guidelines?.length === 0 && <div className="card" style={{ color: "var(--color-muted)" }}>Guidelines haven't been published yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {guidelines?.map((g) => (
          <div key={g.id} className="card">
            <strong style={{ fontSize: 14 }}>{g.category}</strong>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{g.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
