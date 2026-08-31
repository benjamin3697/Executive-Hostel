import { useEffect, useState, useCallback } from "react";
import { api, AuditLogRow, ApiError } from "../lib/api";

function describeValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.auditLogs({ action: action || undefined, entityType: entityType || undefined, page })
      .then((r) => { setLogs(r.logs); setTotal(r.total); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load audit log."));
  }, [action, entityType, page]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce the text filters
    return () => clearTimeout(t);
  }, [load]);

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 4 }}>Audit Log</h1>
      <p style={{ fontSize: 12.5, color: "var(--color-muted)", marginBottom: 16 }}>
        Every payment verification, room change, and permission change, with who did it and when.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter by action (e.g. 'payment.')"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          style={{ maxWidth: 240 }}
        />
        <input
          className="input"
          placeholder="Filter by entity type (e.g. 'Payment')"
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          style={{ maxWidth: 240 }}
        />
      </div>

      {!logs && <div style={{ color: "var(--color-muted)" }}>Loading...</div>}
      {logs?.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--color-muted)" }}>No matching activity.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {logs?.map((log) => (
          <div key={log.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong style={{ fontSize: 13 }}>{log.action}</strong>
                <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: 8 }}>
                  {log.entityType ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}...` : ""}` : ""}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{new Date(log.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
              By {log.actor?.email ?? log.actor?.phone ?? "system"} {log.actor?.role && `(${log.actor.role})`}
            </div>
            {(log.previousValue != null || log.newValue != null) && (
              <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 6, fontFamily: "monospace", wordBreak: "break-all" }}>
                {log.previousValue != null && <div>before: {describeValue(log.previousValue)}</div>}
                {log.newValue != null && <div>after: {describeValue(log.newValue)}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 50 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
          <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ fontSize: 13, alignSelf: "center", color: "var(--color-muted)" }}>Page {page}</span>
          <button className="btn btn-outline" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
