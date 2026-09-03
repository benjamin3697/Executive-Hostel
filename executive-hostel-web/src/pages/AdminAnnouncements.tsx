import { useEffect, useState, FormEvent, useMemo } from "react";
import { Edit3, Megaphone, Trash2, X } from "lucide-react";
import { api, AnnouncementRow, Room, ApiError } from "../lib/api";

const PRIORITY_COLOR: Record<string, string> = { normal: "var(--color-muted)", important: "var(--color-warning)", urgent: "var(--color-danger)" };

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [audienceType, setAudienceType] = useState("all");
  const [sectionRef, setSectionRef] = useState("");
  const [roomRef, setRoomRef] = useState("");
  const [yearRef, setYearRef] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.announcements().then(setAnnouncements).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }
  useEffect(load, []);
  useEffect(() => {
    // Rooms carry section.id, which is exactly what the backend expects as
    // audienceRef for a "section" announcement - no separate /sections
    // endpoint needed, just dedupe what /rooms already gives us.
    api.rooms({}).then(setRooms).catch(() => {});
  }, []);

  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms) map.set(r.section.id, r.section.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rooms]);

  useEffect(() => {
    if (!sectionRef && sections.length) setSectionRef(sections[0].id);
  }, [sections, sectionRef]);
  useEffect(() => {
    if (!roomRef && rooms.length) setRoomRef(rooms[0].id);
  }, [rooms, roomRef]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const audienceRef =
        audienceType === "section" ? sectionRef :
        audienceType === "room" ? roomRef :
        audienceType === "year" ? yearRef :
        undefined;
      if (editingId) {
        await api.updateAnnouncement(editingId, { title, message, priority, audienceType, audienceRef });
      } else {
        await api.createAnnouncement({ title, message, priority, audienceType, audienceRef });
      }
      setTitle("");
      setMessage("");
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(a: AnnouncementRow) {
    setEditingId(a.id);
    setTitle(a.title);
    setMessage(a.message);
    setPriority(a.priority);
    setAudienceType(a.audienceType);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    try {
      await api.deleteAnnouncement(id);
      if (editingId === id) {
        setEditingId(null);
        setTitle("");
        setMessage("");
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Announcements</h1>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
        {editingId && <div className="form-heading"><strong>Edit announcement</strong><button type="button" className="icon-button" aria-label="Cancel editing" onClick={() => { setEditingId(null); setTitle(""); setMessage(""); }}><X size={16} /></button></div>}
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Title</label>
        <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Message</label>
        <textarea className="input" rows={3} required value={message} onChange={(e) => setMessage(e.target.value)} style={{ marginBottom: 12 }} />

        <div className="mobile-two-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Audience</label>
            <select className="input" value={audienceType} onChange={(e) => setAudienceType(e.target.value)}>
              <option value="all">All residents</option>
              <option value="section">Specific section</option>
              <option value="room">Specific room</option>
              <option value="year">Specific year of study</option>
            </select>
          </div>
        </div>

        {audienceType === "section" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Section</label>
            <select className="input" value={sectionRef} onChange={(e) => setSectionRef(e.target.value)}>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {audienceType === "room" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Room</label>
            <select className="input" value={roomRef} onChange={(e) => setRoomRef(e.target.value)}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.section.name} — Room {r.roomNumber}</option>)}
            </select>
          </div>
        )}
        {audienceType === "year" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Year of study</label>
            <select className="input" value={yearRef} onChange={(e) => setYearRef(e.target.value)}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        )}

        {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          <Megaphone size={15} /> {submitting ? "Saving..." : editingId ? "Save changes" : "Publish"}
        </button>
      </form>

      {!announcements && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {announcements?.map((a) => (
          <div key={a.id} className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLOR[a.priority]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{a.title}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[a.priority], textTransform: "uppercase" }}>{a.priority}</span>
                <button className="icon-button" aria-label={`Edit ${a.title}`} title="Edit announcement" onClick={() => startEditing(a)}><Edit3 size={15} /></button>
                <button className="icon-button icon-button-danger" aria-label={`Delete ${a.title}`} title="Delete announcement" onClick={() => handleDelete(a.id)}><Trash2 size={15} /></button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "6px 0" }}>{a.message}</p>
            <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{new Date(a.publishedAt).toLocaleDateString()} · {a.audienceType}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
