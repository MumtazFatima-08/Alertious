import type { ReactNode } from "react";

export default function MetricStat({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  accent?: "cyan" | "orange" | "crit" | "blue" | "violet" | "neutral";
}) {
  const accentColor =
    accent === "cyan" ? "#00E5FF"
    : accent === "orange" ? "#FF8A00"
    : accent === "crit" ? "#FF3D9A"
    : accent === "blue" ? "#3B82FF"
    : accent === "violet" ? "#8B5CF6"
    : "#87878F";

  return (
    <div className="border border-border bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">{label}</div>
        {icon && (
          <div style={{ color: accentColor }} className="opacity-90">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 mono text-2xl font-semibold" style={{ color: accent ? accentColor : "#F2F2F4" }}>
        {value}
      </div>
      {sublabel && <div className="mt-1 text-[11px] text-muted">{sublabel}</div>}
    </div>
  );
}
