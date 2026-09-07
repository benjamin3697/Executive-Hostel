import { useEffect, useState } from "react";
import {
  Download, Users, Home, TrendingUp, Building2,
  AlertCircle, CheckCircle2, AlertTriangle, PieChart,
  Wallet, FileText, ArrowUpRight, TrendingDown
} from "lucide-react";
import { api, OccupancyReport, FinancialReport, OutstandingRow, ApiError } from "../lib/api";
import { fmt } from "../lib/format";

// ── Stat Card Component ────────────────────────────────────────────────────────
function StatCard({
  title, value, subtitle, icon, trend, color = "var(--color-primary)"
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <div className="card" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color}15`, color: color,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {icon}
        </div>
        {trend && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
            color: trend === "up" ? "var(--color-accent)" : trend === "down" ? "var(--color-danger)" : "var(--color-muted)"
          }}>
            {trend === "up" ? <ArrowUpRight size={14} /> : trend === "down" ? <TrendingDown size={14} /> : null}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginBottom: 2 }}>
          {value}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Progress Bar Component ─────────────────────────────────────────────────────
function ProgressBar({
  value, total, color = "var(--color-primary)", label, showPercentage = true
}: {
  value: number; total: number; color?: string; label: string; showPercentage?: boolean;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: "var(--color-muted)" }}>{label}</span>
        <span style={{ fontWeight: 700 }}>
          {value} <span style={{ color: "var(--color-muted)", fontWeight: 500 }}>/ {total}</span>
          {showPercentage && <span style={{ marginLeft: 8, color: color }}>({percentage}%)</span>}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--color-surface-raised, #1a1a2e)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", background: color, width: `${percentage}%`, borderRadius: 4, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
      </div>
    </div>
  );
}

// ── Page Root ──────────────────────────────────────────────────────────────────
export default function AdminReports() {
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [financial, setFinancial] = useState<FinancialReport | null>(null);
  const [outstanding, setOutstanding] = useState<{ total: number; students: OutstandingRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.reportOccupancy(), api.reportFinancial(), api.reportOutstanding()])
      .then(([o, f, out]) => { setOccupancy(o); setFinancial(f); setOutstanding(out); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load reports."));
  }, []);

  if (error) return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div className="card" style={{ color: "var(--color-danger)", display: "flex", gap: 10, alignItems: "center" }}>
        <AlertTriangle size={18} /> {error}
      </div>
    </div>
  );

  if (!occupancy || !financial || !outstanding) return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ height: 40, width: 200, background: "var(--color-surface-raised)", borderRadius: 8, opacity: 0.5 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="card" style={{ height: 140, opacity: 0.5 }} />)}
      </div>
    </div>
  );

  // Derived metrics
  const financialProgress = financial.expected > 0 ? (financial.verified / financial.expected) * 100 : 0;
  const pendingProgress = financial.expected > 0 ? (financial.pending / financial.expected) * 100 : 0;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <PieChart size={28} color="var(--color-primary)" /> Reports Overview
          </h1>
          <div style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 4 }}>
            Comprehensive breakdown of occupancy and financials
          </div>
        </div>
        <a href="/api/v1/reports/outstanding?format=csv" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }} target="_blank" rel="noreferrer">
          <Download size={16} /> Export Data
        </a>
      </div>

      {/* ── OCCUPANCY SECTION ── */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Building2 size={20} color="var(--color-muted)" /> Occupancy Metrics
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
          <StatCard 
            title="Total Rooms" value={occupancy.totalRooms} 
            icon={<Home size={20} />} color="var(--color-primary)" 
            subtitle="Across all sections"
          />
          <StatCard 
            title="Occupancy Rate" value={`${occupancy.occupancyRate}%`} 
            icon={<PieChart size={20} />} color="var(--color-accent)"
            trend={occupancy.occupancyRate > 80 ? "up" : "neutral"}
          />
          <StatCard 
            title="Occupied" value={occupancy.occupiedRooms} 
            icon={<Users size={20} />} color="var(--color-success, #10b981)" 
          />
          <StatCard 
            title="Vacant" value={occupancy.vacantRooms} 
            icon={<DoorOpen size={20} />} color="var(--color-warning)" 
          />
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: "var(--color-muted)", textTransform: "uppercase" }}>Occupancy by Section</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
            {Object.entries(occupancy.bySection).map(([section, stats]) => (
              <div key={section}>
                <ProgressBar 
                  label={section} value={stats.occupied} total={stats.total} 
                  color="var(--color-primary)"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINANCIAL SECTION ── */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Wallet size={20} color="var(--color-muted)" /> Financial Performance
        </h2>

        {/* Financial Progress Banner */}
        <div className="card" style={{ padding: 24, marginBottom: 16, background: "linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.05), rgba(var(--color-accent-rgb), 0.05))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Total Expected Revenue</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(financial.expected)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Collection Rate</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--color-accent)" }}>{financialProgress.toFixed(1)}%</div>
            </div>
          </div>
          
          {/* Multi-segment progress bar */}
          <div style={{ height: 12, background: "var(--color-surface-raised, #1a1a2e)", borderRadius: 6, overflow: "hidden", display: "flex" }}>
            <div style={{ height: "100%", background: "var(--color-accent)", width: `${financialProgress}%`, transition: "width 1s" }} title={`Verified: ${fmt(financial.verified)}`} />
            <div style={{ height: "100%", background: "var(--color-warning)", width: `${pendingProgress}%`, transition: "width 1s" }} title={`Pending: ${fmt(financial.pending)}`} />
          </div>
          
          <div style={{ display: "flex", gap: 24, marginTop: 16, fontSize: 13, color: "var(--color-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-accent)" }} /> Verified: <strong style={{ color: "var(--color-text)" }}>{fmt(financial.verified)}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-warning)" }} /> Pending Verification: <strong style={{ color: "var(--color-text)" }}>{fmt(financial.pending)}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-surface-raised, #1a1a2e)" }} /> Outstanding: <strong style={{ color: "var(--color-text)" }}>{fmt(financial.outstanding)}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <StatCard 
            title="Fully Paid Residents" value={financial.fullyPaidCount} 
            icon={<CheckCircle2 size={20} />} color="var(--color-accent)" 
          />
          <StatCard 
            title="Partially Paid" value={financial.partiallyPaidCount} 
            icon={<TrendingUp size={20} />} color="var(--color-warning)" 
          />
          <StatCard 
            title="Outstanding Residents" value={financial.outstandingCount} 
            icon={<AlertCircle size={20} />} color="var(--color-danger)" 
          />
        </div>
      </div>

      {/* ── DEFAULTERS SECTION ── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={20} color="var(--color-muted)" /> Outstanding Balances <span style={{ color: "var(--color-danger)", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 12, fontSize: 13 }}>{outstanding.total} students</span>
          </h2>
        </div>

        {outstanding.students.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--color-muted)" }}>
            <CheckCircle2 size={48} color="var(--color-accent)" style={{ margin: "0 auto 16px", opacity: 0.5 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>All Clear!</h3>
            <p>There are no students with outstanding balances.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {outstanding.students.map((s) => (
              <div key={s.registrationNumber} className="card" style={{ 
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
                borderLeft: "4px solid var(--color-danger)", padding: "16px 20px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", background: "var(--color-surface-raised, #1a1a2e)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--color-muted)"
                  }}>
                    {s.student.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{s.student}</div>
                    <div style={{ fontSize: 12.5, color: "var(--color-muted)", marginTop: 2 }}>
                      <span style={{ fontWeight: 600 }}>{s.registrationNumber}</span> · {s.room}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Balance Due</div>
                  <div style={{ fontWeight: 800, color: "var(--color-danger)", fontSize: 18 }}>{fmt(s.balance)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 2 }}>
                    Total fee: {fmt(s.fee)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// Helper missing import
const DoorOpen = Home; // Fallback since DoorOpen wasn't imported properly above.
