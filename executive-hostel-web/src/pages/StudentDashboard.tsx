import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, DoorOpen, Wrench } from "lucide-react";
import { api, StudentDashboard as DashboardData, ApiError } from "../lib/api";
import { EmptyState, ErrorState, LoadingState, PageContainer, PageHeader } from "../components/SiteUI";
import { formatUGX } from "../lib/format";

const fmt = (n: number | null) => (n === null ? "—" : formatUGX(Number(n) || 0));

const STATUS_LABEL: Record<string, string> = {
  fully_paid: "Fully Paid",
  partially_paid: "Partially Paid",
  outstanding: "Outstanding",
  no_active_accommodation: "No accommodation assigned yet",
};

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.studentDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard."));
  }, []);

  if (error) return <PageContainer><ErrorState message={error} /></PageContainer>;
  if (!data) return <PageContainer><LoadingState label="Loading your dashboard" /></PageContainer>;

  const paymentNeedsAttention = data.payment.balance !== null && data.payment.balance > 0;
  const totalFee = Number(data.payment.effectiveFee ?? data.payment.fee) || 0;
  const paidProgress = totalFee > 0 ? Math.min(100, Math.max(0, Math.round((Number(data.payment.verifiedPaid) || 0) / totalFee * 100))) : 0;
  const statusTone = data.payment.status === "fully_paid" ? "success" : data.payment.status === "partially_paid" ? "warning" : "danger";
  const paymentSummary = [
    data.payment.carriedBalance > 0 && { label: "Previous balance", value: fmt(data.payment.carriedBalance), tone: "warning" },
    { label: data.payment.carriedBalance > 0 ? "Semester fee" : "Total fee", value: fmt(data.payment.fee) },
    data.payment.carriedBalance > 0 && { label: "Total due", value: fmt(data.payment.effectiveFee), tone: "warning" },
    { label: "Verified paid", value: fmt(data.payment.verifiedPaid), tone: "success" },
    { label: "Pending verification", value: fmt(data.payment.pendingAmount) },
    { label: "Outstanding balance", value: fmt(data.payment.balance), tone: paymentNeedsAttention ? "danger" : "success" },
  ].filter(Boolean) as { label: string; value: string; tone?: string }[];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Student portal"
        title={`Welcome, ${data.student.fullName.split(" ")[0]}`}
        description="Keep track of your room, fees, announcements, and support requests in one place."
        actions={paymentNeedsAttention ? <Link to="/payments/submit" className="btn btn-primary">Submit payment <ArrowRight size={16} aria-hidden="true" /></Link> : undefined}
      />

      <div className="dashboard-grid">
        <section className="card dashboard-room-card">
          <div className="dashboard-card-heading"><span className="eyebrow">Accommodation</span><DoorOpen size={20} aria-hidden="true" /></div>
          {data.accommodation ? (
            <>
              <h2>Room {data.accommodation.roomNumber}</h2>
              <p>{data.accommodation.roomType} · {data.accommodation.section}</p>
              <small>Registration number: {data.student.registrationNumber}</small>
            </>
          ) : <EmptyState title="No room assigned yet" description="Your accommodation details will appear here once a room is assigned." icon={<DoorOpen size={22} aria-hidden="true" />} />}
        </section>
        <section className="card dashboard-status-card">
          <span className="eyebrow">Payment status</span>
          <div className={`dashboard-status-icon ${paymentNeedsAttention ? "is-warning" : "is-success"}`} aria-hidden="true">{paymentNeedsAttention ? "!" : "✓"}</div>
          <h2>{STATUS_LABEL[data.payment.status] ?? data.payment.status}</h2>
          <p>{paymentNeedsAttention ? "There is an outstanding balance on your account." : "Your account is up to date."}</p>
          <span className={`payment-status-badge payment-status-${statusTone}`}>{STATUS_LABEL[data.payment.status] ?? "Unpaid / Overdue"}</span>
          <div className="dashboard-payment-progress"><div className="payment-progress-label"><span>{paidProgress}% paid</span><strong>{formatUGX(Number(data.payment.verifiedPaid) || 0)}</strong></div><div className="payment-progress-track"><div className={`payment-progress-fill payment-progress-${statusTone}`} style={{ width: `${paidProgress}%` }} /></div></div>
          <Link to="/payments/history" className="text-link">View payment history <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </div>

      <section className="dashboard-section">
        <div className="section-heading"><div><span className="eyebrow">Account overview</span><h2>Fees at a glance</h2></div></div>
        <div className="dashboard-metrics">
          {paymentSummary.map((item) => <div key={item.label} className={`card metric-card ${item.tone ? `metric-${item.tone}` : ""}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}
        </div>
      </section>

      {data.urgentAnnouncements.length > 0 && <section className="dashboard-section"><div className="section-heading"><div><span className="eyebrow">Needs your attention</span><h2>Important announcements</h2></div><Link to="/announcements" className="text-link">See all <ArrowRight size={15} aria-hidden="true" /></Link></div><div className="dashboard-announcements">{data.urgentAnnouncements.map((a) => <article key={a.id} className="card announcement-item"><AlertTriangle size={19} aria-hidden="true" /><div><strong>{a.title}</strong><p>{a.message}</p></div></article>)}</div></section>}

      {data.openMaintenanceRequests > 0 && <Link to="/maintenance" className="card dashboard-maintenance"><Wrench size={19} aria-hidden="true" /><span><strong>{data.openMaintenanceRequests} open maintenance request{data.openMaintenanceRequests === 1 ? "" : "s"}</strong><small>View request updates</small></span><ArrowRight size={17} aria-hidden="true" /></Link>}
    </PageContainer>
  );
}
