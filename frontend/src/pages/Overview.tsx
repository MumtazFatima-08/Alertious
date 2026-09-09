import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Activity, ShieldAlert, GitMerge, Flame } from "lucide-react";
import { api } from "../services/api";
import type { AlertiousEvent, Incident, Stats } from "../types";
import PageHeader from "../components/PageHeader";
import MetricStat from "../components/MetricStat";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import SignalBars from "../components/SignalBars";
import { LoadingState, EmptyState, ErrorState } from "../components/States";
import { relativeTime, eventTypeLabel, formatClock } from "../utils/format";
import { useLiveEvents } from "../hooks/useLiveEvents";

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [recentEvents, setRecentEvents] = useState<AlertiousEvent[]>([]);
  const [stream, setStream] = useState<AlertiousEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api.stats(), api.listIncidents({ sort: "risk_desc" }), api.listEvents({ page: 1, page_size: 60, sort: "timestamp_desc" })])
      .then(([s, inc, events]) => {
        setStats(s);
        setIncidents(inc.filter((i) => i.status === "OPEN" || i.status === "INVESTIGATING").slice(0, 6));
        setRecentEvents(events.items);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  useLiveEvents((event) => {
    setStream((prev) => [event, ...prev].slice(0, 12));
    load();
  });

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader eyebrow="Security operations" title="Overview" description="From alerts to incidents." />

      <div className="px-5 py-5 md:px-8 md:py-6">
        {!stats ? (
          <LoadingState label="Loading operational metrics…" />
        ) : (
          <>
            {/* Attention summary — direct read of the same stats, framed as what needs a look */}
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border border-border bg-surface px-5 py-4">
              <AttentionFigure value={stats.high_priority_incidents} label="high priority" color="#FF3D9A" />
              <AttentionFigure value={stats.active_incidents} label="active incidents" color="#FF8A00" />
              <AttentionFigure value={stats.events_correlated} label="correlated events" color="#3B82FF" />
              <AttentionFigure value={`${stats.correlation_rate}%`} label="correlation rate" color="#00E5FF" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricStat label="Events processed" value={stats.events_processed.toLocaleString()} icon={<Activity size={16} />} accent="blue" />
              <MetricStat
                label="Correlation rate"
                value={`${stats.correlation_rate}%`}
                sublabel={`${stats.events_correlated} correlated`}
                icon={<GitMerge size={16} />}
                accent="cyan"
              />
              <MetricStat label="Active incidents" value={stats.active_incidents} icon={<ShieldAlert size={16} />} accent="neutral" />
              <MetricStat label="High priority" value={stats.high_priority_incidents} icon={<Flame size={16} />} accent="orange" />
            </div>
          </>
        )}

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-text">Live signal activity</h2>
          <div className="border border-border bg-surface p-4">
            <SignalBars events={recentEvents} />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
              <LegendDot color="#FF3D9A" label="Critical" />
              <LegendDot color="#FF8A00" label="High" />
              <LegendDot color="#FFD43B" label="Medium" />
              <LegendDot color="#2A2A2E" label="Low / none" />
              <span className="ml-auto">Last {recentEvents.length} events, bucketed by time</span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Active incidents</h2>
              <Link to="/incidents" className="text-xs text-blue hover:underline">
                View all
              </Link>
            </div>
            <div className="border border-border bg-surface">
              {incidents === null ? (
                <LoadingState />
              ) : incidents.length === 0 ? (
                <EmptyState title="No active incidents" description="Run the simulator to generate a scenario, or wait for correlated activity to arrive." />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-medium">Incident</th>
                      <th className="px-4 py-2 font-medium">Severity</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Entity</th>
                      <th className="hidden px-4 py-2 font-medium md:table-cell">Alerts</th>
                      <th className="px-4 py-2 font-medium">Detected</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-surface2">
                        <td className="px-4 py-2.5">
                          <Link to={`/investigate/${inc.id}`} className="hover:text-cyan">
                            <div className="mono text-[11px] text-muted">{inc.id}</div>
                            <div className="font-medium text-text">{inc.title}</div>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <SeverityBadge severity={inc.severity} />
                        </td>
                        <td className="hidden px-4 py-2.5 mono text-xs text-muted sm:table-cell">{inc.users[0] ?? "—"}</td>
                        <td className="hidden px-4 py-2.5 text-xs text-muted md:table-cell">{inc.alert_count} alerts</td>
                        <td className="px-4 py-2.5 text-xs text-muted">{relativeTime(inc.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={inc.status} kind="incident" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Live alert stream</h2>
              <span className="flex items-center gap-1 text-[10px] text-cyan">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-cyan" style={{ boxShadow: "0 0 6px #00E5FF99" }} /> LIVE
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto border border-border bg-surface">
              {stream.length === 0 ? (
                <EmptyState
                  title="Waiting for activity"
                  description="New events will appear here in real time as they're ingested and correlated."
                />
              ) : (
                <ul>
                  {stream.map((e) => (
                    <li key={e.id} className="enter-row border-b border-border px-3 py-2 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-text">{eventTypeLabel(e.event_type)}</span>
                        <SeverityBadge severity={e.severity} compact />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                        <span className="mono">{e.user ?? e.source_ip ?? "unknown"}</span>
                        <span className="mono">{formatClock(e.timestamp)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttentionFigure({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div>
      <div className="mono text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-[1px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
