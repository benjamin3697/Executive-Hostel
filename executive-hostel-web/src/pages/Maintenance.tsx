import { useEffect, useState, FormEvent } from "react";
import { Wrench } from "lucide-react";
import { api, MaintenanceRow, ApiError } from "../lib/api";
import { StatusBadge } from "../lib/format";

const CATEGORIES = ["electricity", "water", "plumbing", "door_lock", "lighting", "furniture", "cleaning", "internet", "other"];

export default function Maintenance() {
  const [requests, setRequests] = useState<MaintenanceRow[] | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.myMaintenance().then(setRequests).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load."));
  }
  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.submitMaintenance({ category, description });
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Maintenance</h1>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Category</label>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginBottom: 12 }}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Describe the issue</label>
        <textarea className="input" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginBottom: 12 }} />
        {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          <Wrench size={15} /> {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>

      {!requests && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests?.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <strong style={{ fontSize: 13, textTransform: "capitalize" }}>{r.category.replace(/_/g, " ")}</strong>
              <StatusBadge status={r.status} />
            </div>
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>{r.description}</div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
