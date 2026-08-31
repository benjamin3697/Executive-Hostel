export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : "UGX " + n.toLocaleString());

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  fully_paid: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  verified: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  partially_paid: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  pending: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  clarification_requested: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  outstanding: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  rejected: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  no_active_accommodation: { bg: "#EDEDED", fg: "#888" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#EDEDED", fg: "#888" };
  return (
    <span className="badge" style={{ background: c.bg, color: c.fg }}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
