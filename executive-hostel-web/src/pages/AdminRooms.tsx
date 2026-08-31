import { useEffect, useState, useCallback } from "react";
import { Building2, X, Search } from "lucide-react";
import { api, Room, StudentRow, ApiError } from "../lib/api";

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  occupied: { label: "Occupied", bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  vacant: { label: "Vacant", bg: "#F1ECE3", fg: "var(--color-muted)" },
  reserved: { label: "Reserved", bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  under_maintenance: { label: "Maintenance", bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  temporarily_unavailable: { label: "Unavailable", bg: "#EDEDED", fg: "#888" },
};

// ---------------------------------------------------------------------------
// Student picker - opened when assigning a vacant room. Searches
// GET /students (debounced) and hands the chosen student back to the caller.
// ---------------------------------------------------------------------------
function StudentPicker({ onPick, onClose }: { onPick: (student: StudentRow) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      // Only applicants/active students without a current room are useful
      // here - the backend's assignRoom() rejects anyone who already has
      // one anyway, but filtering client-side avoids a confusing dead click.
      api.students({ q: q || undefined })
        .then((r) => setResults(r.students.filter((s) => !s.currentRoom)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(51,40,33,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div className="card" style={{ width: 420, maxWidth: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Assign a student</strong>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: 6 }}><X size={16} /></button>
        </div>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 12, color: "var(--color-muted)" }} />
          <input
            className="input"
            placeholder="Search by name, registration number, or phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
            autoFocus
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Searching...</div>}
          {!loading && results.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
              No unassigned students found{q ? ` matching "${q}"` : ""}.
            </div>
          )}
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="btn btn-outline"
              style={{ justifyContent: "flex-start", textAlign: "left", width: "100%" }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.fullName}</div>
                <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
                  {s.registrationNumber} {s.course && `· ${s.course}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminRooms() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [pickerForRoom, setPickerForRoom] = useState<Room | null>(null);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.rooms({ section, status })
      .then(setRooms)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load rooms."));
  }, [section, status]);

  useEffect(() => { load(); }, [load]);

  async function handleAssign(room: Room, student: StudentRow) {
    setPickerForRoom(null);
    setBusyRoomId(room.id);
    try {
      await api.assignRoom(room.id, student.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to assign room.");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function handleCheckOut(room: Room) {
    if (!room.currentStudent) return;
    const reason = prompt("Reason for check-out (optional):") ?? undefined;
    setBusyRoomId(room.id);
    try {
      await api.checkOutStudent(room.id, room.currentStudent.id, { reason });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to check out.");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function handleCheckIn(room: Room) {
    if (!room.currentStudent) return;
    setBusyRoomId(room.id);
    try {
      await api.checkInStudent(room.id, room.currentStudent.id);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_CHECKED_IN") {
        // Not really an error from the admin's point of view - nothing to do.
        return;
      }
      alert(err instanceof ApiError ? err.message : "Failed to check in.");
    } finally {
      setBusyRoomId(null);
    }
  }

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  const grouped = rooms
    ? { "Executive Main": rooms.filter((r) => r.section.name === "Executive Main"), "Executive Annex": rooms.filter((r) => r.section.name === "Executive Annex") }
    : null;

  return (
    <div style={{ padding: 24 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Room Management</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {["Executive Main", "Executive Annex"].map((s) => (
          <button
            key={s}
            onClick={() => setSection(section === s ? undefined : s)}
            className="btn"
            style={{ background: section === s ? "var(--color-primary)" : "#fff", color: section === s ? "#fff" : "var(--color-text)", borderColor: "var(--color-border)" }}
          >
            {s}
          </button>
        ))}
        <div style={{ width: 1, background: "var(--color-border)" }} />
        {["vacant", "occupied", "reserved", "under_maintenance"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? undefined : s)}
            className="btn"
            style={{ background: status === s ? "var(--color-accent)" : "#fff", color: status === s ? "#fff" : "var(--color-text)", borderColor: "var(--color-border)" }}
          >
            {STATUS_STYLE[s]?.label ?? s}
          </button>
        ))}
      </div>

      {!rooms && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}

      {grouped && Object.entries(grouped).map(([sectionName, list]) => list.length > 0 && (
        <div key={sectionName} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={15} /> {sectionName.toUpperCase()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {list.map((r) => {
              const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.vacant;
              const busy = busyRoomId === r.id;
              return (
                <div key={r.id} className="card" style={{ borderLeft: `4px solid ${style.fg}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="font-display" style={{ fontSize: 18, fontWeight: 600 }}>Room {r.roomNumber}</span>
                    <span className="badge" style={{ background: style.bg, color: style.fg }}>{style.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>{r.roomType.name}</div>
                  {r.currentStudent && (
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{r.currentStudent.fullName}</div>
                  )}

                  {r.status === "vacant" && (
                    <button disabled={busy} onClick={() => setPickerForRoom(r)} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: "6px 10px" }}>
                      {busy ? "Assigning..." : "Assign Student"}
                    </button>
                  )}
                  {r.status === "occupied" && r.currentStudent && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button disabled={busy} onClick={() => handleCheckIn(r)} className="btn btn-outline" style={{ flex: 1, fontSize: 11, padding: "6px 8px", justifyContent: "center" }}>
                        Check In
                      </button>
                      <button disabled={busy} onClick={() => handleCheckOut(r)} className="btn btn-danger" style={{ flex: 1, fontSize: 11, padding: "6px 8px", justifyContent: "center" }}>
                        Check Out
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {pickerForRoom && (
        <StudentPicker
          onPick={(student) => handleAssign(pickerForRoom, student)}
          onClose={() => setPickerForRoom(null)}
        />
      )}
    </div>
  );
}
