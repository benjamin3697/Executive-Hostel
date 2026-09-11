import { Building2 } from "lucide-react";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-hidden="true">
      <Building2 size={compact ? 17 : 20} strokeWidth={2.2} />
    </span>
  );
}