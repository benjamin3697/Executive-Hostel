import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, OccupancyReport, FinancialReport, OutstandingRow, ApiError } from "../lib/api";
import { fmt } from "../lib/format";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

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

  if (error) return <div style={{ padding: 24, color: "var(--color-danger)" }}>{error}</div>;
  if (!occupancy || !financial || !outstanding) return <div style={{ padding: 24, color: "var(--color-muted)" }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1 className="font-display" style={{ fontSize: 22, marginBottom: 16 }}>Reports</h1>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10 }}>OCCUPANCY</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
        <StatCard label="Total Rooms" value={occupancy.totalRooms} />
        <StatCard label="Occupied" value={occupancy.occupiedRooms} />
        <StatCard label="Vacant" value={occupancy.vacantRooms} />
        <StatCard label="Occupancy Rate" value={`${occupancy.occupancyRate}%`} />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", marginBottom: 10 }}>FINANCIAL</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
        <StatCard label="Expected" value={fmt(financial.expected)} />
        <StatCard label="Verified" value={fmt(financial.verified)} />
        <StatCard label="Pending Verification" value={fmt(financial.pending)} />
        <StatCard label="Outstanding" value={fmt(financial.outstanding)} />
        <StatCard label="Fully Paid Students" value={financial.fullyPaidCount} />
        <StatCard label="Partially Paid" value={financial.partiallyPaidCount} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)" }}>WHO HASN'T PAID? ({outstanding.total})</h2>
        <a href="/api/v1/reports/outstanding?format=csv" className="btn btn-outline" style={{ fontSize: 12 }} target="_blank" rel="noreferrer">
          <Download size={14} /> Export CSV
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {outstanding.students.map((s) => (
          <div key={s.registrationNumber} className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.student}</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.room} · {s.registrationNumber}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: "var(--color-danger)" }}>{fmt(s.balance)}</div>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>of {fmt(s.fee)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
