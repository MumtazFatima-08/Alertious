const INCIDENT_CONFIG: Record<string, { color: string }> = {
  OPEN: { color: "#3B82FF" },
  INVESTIGATING: { color: "#FFD43B" },
  RESOLVED: { color: "#20E3A2" },
  FALSE_POSITIVE: { color: "#87878F" },
};

const ALERT_CONFIG: Record<string, { color: string }> = {
  NEW: { color: "#3B82FF" },
  INVESTIGATING: { color: "#FFD43B" },
  EXPECTED: { color: "#87878F" },
  RESOLVED: { color: "#20E3A2" },
};

export default function StatusBadge({ status, kind = "incident" }: { status: string; kind?: "incident" | "alert" }) {
  const cfg = (kind === "incident" ? INCIDENT_CONFIG : ALERT_CONFIG)[status] ?? { color: "#87878F" };
  const label = status.replace("_", " ");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-1.5 py-0.5 text-[11px] font-medium text-text">
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {label}
    </span>
  );
}
