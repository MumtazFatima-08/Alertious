import { useMemo } from "react";
import type { AlertiousEvent, Severity } from "../types";

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "#FF3D9A",
  HIGH: "#FF8A00",
  MEDIUM: "#FFD43B",
  LOW: "#2A2A2E",
};
const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

/**
 * Renders recent events as a bucketed activity signal: time is divided into
 * `buckets` equal windows, each bar's height reflects event volume in that
 * window and its color reflects the highest severity observed in it. This is
 * a direct visualization of real event data, not a decorative animation.
 */
export default function SignalBars({ events, buckets = 32, height = 64 }: { events: AlertiousEvent[]; buckets?: number; height?: number }) {
  const bars = useMemo(() => {
    if (events.length === 0) return [];
    const timestamps = events
      .map((e) => (e.timestamp ? new Date(e.timestamp.endsWith("Z") || e.timestamp.includes("+") ? e.timestamp : e.timestamp + "Z").getTime() : null))
      .filter((t): t is number => t !== null);
    if (timestamps.length === 0) return [];
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const span = Math.max(max - min, 1);

    const slots: { count: number; severity: number }[] = Array.from({ length: buckets }, () => ({ count: 0, severity: -1 }));

    events.forEach((e) => {
      if (!e.timestamp) return;
      const t = new Date(e.timestamp.endsWith("Z") || e.timestamp.includes("+") ? e.timestamp : e.timestamp + "Z").getTime();
      const idx = Math.min(buckets - 1, Math.floor(((t - min) / span) * buckets));
      slots[idx].count += 1;
      const rank = SEVERITY_RANK[e.severity] ?? 0;
      if (rank > slots[idx].severity) slots[idx].severity = rank;
    });

    const maxCount = Math.max(...slots.map((s) => s.count), 1);
    const rankToSeverity: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    return slots.map((s) => ({
      pct: s.count === 0 ? 0.04 : Math.max(0.08, s.count / maxCount),
      color: s.count === 0 ? "#1A1A1D" : SEVERITY_COLOR[rankToSeverity[s.severity]],
    }));
  }, [events, buckets]);

  if (bars.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted">
        No recent activity to visualize
      </div>
    );
  }

  return (
    <div style={{ height }} className="flex items-end gap-[3px]" role="img" aria-label="Recent alert signal activity, colored by severity">
      {bars.map((b, i) => (
        <div
          key={i}
          className="signal-bar flex-1 rounded-[1px]"
          style={{
            height: `${Math.round(b.pct * 100)}%`,
            backgroundColor: b.color,
            boxShadow: b.color !== "#1A1A1D" ? `0 0 8px ${b.color}55` : undefined,
          }}
        />
      ))}
    </div>
  );
}
