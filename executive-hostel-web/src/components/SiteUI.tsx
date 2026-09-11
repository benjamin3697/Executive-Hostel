import { AlertCircle, CheckCircle2, Inbox, LoaderCircle } from "lucide-react";
import { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`page-container ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`page-header ${className}`}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spinner" size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon ?? <Inbox size={24} aria-hidden="true" />}</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && <button className="btn btn-outline btn-small" type="button" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={17} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? "field-has-error" : ""}`}>
      <label>{label}</label>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-visual" aria-hidden="true">
        <img src="/images/hostel-exterior.jpg" alt="" fetchPriority="high" decoding="async" />
        <div className="auth-visual-scrim" />
        <div className="auth-visual-content">
          <div className="auth-visual-brand"><span className="brand-mark"><span>EH</span></span><span>Executive Hostel</span></div>
          <p>Comfortable, independent student living in Soroti.</p>
        </div>
      </div>
      <div className="auth-card-wrap">
        <div className="auth-card card">
          <div className="auth-card-heading">
            <div>
              <div className="eyebrow">Student portal</div>
              <h1>{title}</h1>
            </div>
            <span className="brand-mark brand-mark-compact"><span>EH</span></span>
          </div>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
        <div className="auth-card-footer">Executive Hostel · Soroti University</div>
      </div>
    </div>
  );
}
