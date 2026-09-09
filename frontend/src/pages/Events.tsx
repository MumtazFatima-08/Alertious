import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../services/api";
import type { AlertiousEvent, PaginatedEvents } from "../types";
import PageHeader from "../components/PageHeader";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import AlertDetailPanel from "../components/AlertDetailPanel";
import { LoadingState, EmptyState, ErrorState } from "../components/States";
import { formatTimestamp, eventTypeLabel } from "../utils/format";
import { useLiveEvents } from "../hooks/useLiveEvents";

const EVENT_TYPES = [
  "",
  "LOGIN_FAILED",
  "LOGIN_SUCCESS",
  "NEW_DEVICE",
  "PRIVILEGE_CHANGE",
  "FILE_ACCESS",
  "NETWORK_CONNECTION",
  "PROCESS_EXECUTION",
  "DATA_TRANSFER",
  "LOGOUT",
];
const SEVERITIES = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function Events() {
  const [data, setData] = useState<PaginatedEvents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [severity, setSeverity] = useState("");
  const [selected, setSelected] = useState<AlertiousEvent | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setData(null);
    api
      .listEvents({ page, page_size: pageSize, search: search || undefined, event_type: eventType || undefined, severity: severity || undefined })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page, pageSize, search, eventType, severity, refreshTick]);

  useEffect(() => setPage(1), [search, eventType, severity]);

  useLiveEvents(() => {
    if (page === 1) setRefreshTick((t) => t + 1);
  });

  return (
    <div>
      <PageHeader eyebrow="Event explorer" title="Events" description="Every normalized event flowing through the pipeline." />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 md:px-8">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 border border-border bg-surface px-2.5 py-1.5">
          <Search size={14} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, IP, device…"
            className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            aria-label="Search events"
          />
        </div>
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline-none" aria-label="Filter by event type">
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t ? eventTypeLabel(t) : "All event types"}
            </option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline-none" aria-label="Filter by severity">
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s || "All severities"}
            </option>
          ))}
        </select>
      </div>

      <div className="px-5 py-5 md:px-8 md:py-6">
        {error ? (
          <ErrorState message={error} />
        ) : (
          <div className="border border-border bg-surface">
            {data === null ? (
              <LoadingState />
            ) : data.items.length === 0 ? (
              <EmptyState title="No events match these filters" description="Try clearing a filter, or run the simulator from the Simulator page." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-medium">Timestamp</th>
                      <th className="px-4 py-2 font-medium">Event Type</th>
                      <th className="px-4 py-2 font-medium">Severity</th>
                      <th className="px-4 py-2 font-medium">User</th>
                      <th className="px-4 py-2 font-medium">IP</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Device</th>
                      <th className="hidden px-4 py-2 font-medium md:table-cell">Source</th>
                      <th className="px-4 py-2 font-medium">Incident</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelected(e)}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(ev) => ev.key === "Enter" && setSelected(e)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-surface2"
                      >
                        <td className="px-4 py-2.5 mono text-xs text-muted">{formatTimestamp(e.timestamp)}</td>
                        <td className="px-4 py-2.5 text-text">{eventTypeLabel(e.event_type)}</td>
                        <td className="px-4 py-2.5">
                          <SeverityBadge severity={e.severity} />
                        </td>
                        <td className="px-4 py-2.5 mono text-xs text-text">{e.user ?? "—"}</td>
                        <td className="px-4 py-2.5 mono text-xs text-text">{e.source_ip ?? "—"}</td>
                        <td className="hidden px-4 py-2.5 mono text-xs text-muted sm:table-cell">{e.device_id ?? "—"}</td>
                        <td className="hidden px-4 py-2.5 text-xs text-muted md:table-cell">{e.source ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {e.incident_id ? (
                            <span className="mono text-xs text-blue">{e.incident_id}</span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted">
                <span>
                  Page {data.page} of {data.total_pages} · {data.total} events
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <button
                    disabled={page >= data.total_pages}
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <AlertDetailPanel
          event={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            setRefreshTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}
