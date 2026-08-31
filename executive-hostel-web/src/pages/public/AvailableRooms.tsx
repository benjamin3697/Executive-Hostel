import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { fmt } from "../../lib/format";

interface AvailableRoom { id: string; section: string; roomNumber: string; roomType: string; status: string; }
interface Fee { roomType: string; amount: number | null; }

export default function AvailableRooms() {
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);

  useEffect(() => {
    api.availableRooms().then(setRooms).catch(() => setRooms([]));
    api.currentFees().then(setFees).catch(() => {});
  }, []);

  const feeFor = (type: string) => fees.find((f) => f.roomType === type)?.amount ?? null;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 16 }}>Available Rooms</h1>
      {!rooms && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {rooms?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No vacant rooms right now — check back soon, or apply to be waitlisted.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {rooms?.map((r) => (
          <div key={r.id} className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase" }}>{r.section}</div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 600 }}>Room {r.roomNumber}</div>
            <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 8 }}>{r.roomType} · Single Room</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-accent)" }}>{fmt(feeFor(r.roomType))}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link to="/apply" className="btn btn-primary">Apply for Accommodation</Link>
      </div>
    </div>
  );
}
