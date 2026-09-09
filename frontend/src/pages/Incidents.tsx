import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../services/api";
import type { Incident } from "../types";
import PageHeader from "../components/PageHeader";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import { LoadingState, EmptyState, ErrorState } from "../components/States";
import { relativeTime } from "../utils/format";

const SEVERITIES = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES = ["", "OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"];

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("updated_desc");

  useEffect(() => {
    setIncidents(null);
    api
      .listIncidents({ search: search || undefined, severity: severity || undefined, status: status || undefined, sort })
      .then(setIncidents)
      .catch((e) => setError(e.message));
  }, [search, severity, status, sort]);

  const timeFiltered = useMemo(() => incidents ?? [], [incidents]);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader eyebrow="Investigation inbox" title="Incidents" description="Correlated alert groups awaiting review." />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 md:px-8">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 border border-border bg-surface px-2.5 py-1.5">
          <Search size={14} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incident titles…"
            className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            aria-label="Search incidents"
          />
        </div>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline-none"
          aria-label="Filter by severity"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s || "All severities"}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline-none"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace("_", " ") : "All statuses"}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline-none"
          aria-label="Sort incidents"
        >
          <option value="updated_desc">Recently updated</option>
          <option value="risk_desc">Highest risk</option>
          <option value="created_desc">Newest</option>
        </select>
      </div>

      <div className="px-5 py-5 md:px-8 md:py-6">
        <div className="border border-border bg-surface">
          {incidents === null ? (
            <LoadingState />
          ) : timeFiltered.length === 0 ? (
            <EmptyState title="No incidents match these filters" description="Try clearing a filter, or run the simulator to generate activity." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Alerts</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Entities</th>
                  <th className="hidden px-4 py-2 font-medium lg:table-cell">Created</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {timeFiltered.map((inc) => (
                  <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-surface2">
                    <td className="px-4 py-2.5 mono text-xs text-muted">
                      <Link to={`/investigate/${inc.id}`} className="hover:text-cyan">
                        {inc.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link to={`/investigate/${inc.id}`} className="font-medium text-text hover:text-cyan">
                        {inc.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="px-4 py-2.5 mono text-xs text-text">{inc.risk_score}/100</td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted sm:table-cell">{inc.alert_count}</td>
                    <td className="hidden px-4 py-2.5 mono text-xs text-muted md:table-cell">{inc.users.join(", ") || "—"}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted lg:table-cell">{relativeTime(inc.created_at)}</td>
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
    </div>
  );
}
