import type { Severity } from "../types";

const CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: "#FF3D9A", bg: "rgba(255,61,154,0.12)", label: "CRITICAL" },
  HIGH: { color: "#FF8A00", bg: "rgba(255,138,0,0.12)", label: "HIGH" },
  MEDIUM: { color: "#FFD43B", bg: "rgba(255,212,59,0.10)", label: "MEDIUM" },
  LOW: { color: "#87878F", bg: "rgba(135,135,143,0.10)", label: "LOW" },
};

export default function SeverityBadge({ severity, compact }: { severity: Severity; compact?: boolean }) {
  const cfg = CONFIG[severity] ?? CONFIG.LOW;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tracking-wide mono"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.color + "40" }}
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}80` }} />
      {compact ? cfg.label[0] : cfg.label}
    </span>
  );
}
