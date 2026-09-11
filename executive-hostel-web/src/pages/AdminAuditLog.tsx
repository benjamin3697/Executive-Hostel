import { useEffect, useState, useCallback } from "react";
import { Activity, ChevronDown, Clock3, Filter, ShieldCheck } from "lucide-react";
import { api, AuditLogRow, ApiError } from "../lib/api";
import { ErrorState, LoadingState, PageContainer, PageHeader } from "../components/SiteUI";

function formatMoney(value: unknown) {
  return typeof value === "number" ? `UGX ${value.toLocaleString("en-UG")}` : null;
}

function actionMeta(log: AuditLogRow) {
  const action = log.action.toLowerCase();
  if (action.includes("auth") || action.includes("login")) return { label: "Authentication", tone: "info" };
  if (action.includes("fee") && (action.includes("create") || action.includes("add"))) return { label: "Fee created", tone: "success" };
  if (action.includes("application") && action.includes("reject")) return { label: "Application rejected", tone: "danger" };
  if (action.includes("maintenance") && (action.includes("update") || action.includes("status"))) return { label: "Maintenance updated", tone: "warning" };
  if (action.includes("payment")) return { label: "Payment activity", tone: "success" };
  return { label: action.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), tone: "info" };
}

function describeActivity(log: AuditLogRow) {
  const rawValue = log.newValue ?? log.previousValue;
  const value = rawValue && typeof rawValue === "object" ? rawValue as Record<string, unknown> : {};
  const actor = log.actor?.role ? log.actor.role.replace(/_/g, " ") : "A user";
  const action = log.action.toLowerCase();
  const amount = formatMoney(value.amount);
  const roomType = typeof value.roomType === "string" ? value.roomType : typeof value.name === "string" ? value.name : null;
  if (action.includes("fee") && amount) return `${actor} created a fee of ${amount}${roomType ? ` for ${roomType}` : ""}.`;
  if (action.includes("application") && action.includes("reject")) return `${actor} rejected an accommodation application.`;
  if (action.includes("maintenance") && (action.includes("update") || action.includes("status"))) return `${actor} updated a maintenance request${typeof value.status === "string" ? ` to ${value.status.replace(/_/g, " ")}` : ""}.`;
  if (action.includes("login") || action.includes("auth")) return `${actor} completed an authentication activity.`;
  if (action.includes("payment") && amount) return `${actor} recorded payment activity for ${amount}.`;
  return `${actor} performed ${action.replace(/[._]/g, " ")}.`;
}

function TechDetails({ log }: { log: AuditLogRow }) {
  return (
    <details className="audit-tech-details">
      <summary><ChevronDown size={14} aria-hidden="true" /> View tech details</summary>
      <div className="audit-tech-grid">
        <span>Action</span><code>{log.action}</code>
        <span>Entity</span><code>{log.entityType ?? "-"}{log.entityId ? ` · ${log.entityId}` : ""}</code>
        {log.previousValue != null && <><span>Before</span><code>{JSON.stringify(log.previousValue, null, 2)}</code></>}
        {log.newValue != null && <><span>After</span><code>{JSON.stringify(log.newValue, null, 2)}</code></>}
      </div>
    </details>
  );
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
      .then((result) => { setLogs(result.logs); setTotal(result.total); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load audit log."));
  }, [action, entityType, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (error) return <PageContainer><ErrorState message={error} /></PageContainer>;

  return (
    <PageContainer className="audit-page">
      <PageHeader eyebrow="System activity" title="Audit log" description="A clear record of important actions across the hostel portal." />
      <div className="audit-filters"><Filter size={16} aria-hidden="true" /><input className="input" placeholder="Filter by action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} /><input className="input" placeholder="Filter by entity" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} /></div>
      {!logs && <LoadingState label="Loading activity" />}
      {logs?.length === 0 && <div className="card audit-empty"><Activity size={22} aria-hidden="true" /><strong>No matching activity</strong><span>Try clearing one of the filters.</span></div>}
      <div className="audit-list">{logs?.map((log) => { const meta = actionMeta(log); return <article key={log.id} className="card audit-card"><div className={`audit-icon audit-icon-${meta.tone}`}><ShieldCheck size={18} aria-hidden="true" /></div><div className="audit-card-main"><div className="audit-card-top"><span className={`audit-action audit-action-${meta.tone}`}>{meta.label}</span><time><Clock3 size={13} aria-hidden="true" />{new Date(log.createdAt).toLocaleString()}</time></div><h2>{describeActivity(log)}</h2><p>By {log.actor?.email ?? log.actor?.phone ?? "system"}{log.entityType ? ` · ${log.entityType}` : ""}</p><TechDetails log={log} /></div></article>; })}</div>
      {total > 50 && <div className="audit-pagination"><button className="btn btn-outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page}</span><button className="btn btn-outline" disabled={page * 50 >= total} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </PageContainer>
  );
}
