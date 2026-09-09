import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, CheckCircle2, ShieldQuestion } from "lucide-react";
import { api } from "../services/api";
import type { AlertiousEvent, Guidance, Incident } from "../types";
import PageHeader from "../components/PageHeader";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import AlertDetailPanel from "../components/AlertDetailPanel";
import SignalBars from "../components/SignalBars";
import { LoadingState, EmptyState, ErrorState } from "../components/States";
import { formatTimestamp, eventTypeLabel } from "../utils/format";

const SEVERITY_ORDER = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
const INCIDENT_STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"];

export default function Investigate() {
  const { incidentId } = useParams();
  const navigate = useNavigate();

  if (!incidentId) return <IncidentPicker />;
  return <InvestigationView incidentId={incidentId} />;
}

function IncidentPicker() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listIncidents({ sort: "updated_desc" }).then(setIncidents);
  }, []);

  const filtered = (incidents ?? []).filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Investigate" title="Open an incident" description="Choose an incident to review its full timeline, evidence, and guidance." />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <div className="mb-3 flex max-w-md items-center gap-2 border border-border bg-surface px-2.5 py-1.5">
          <Search size={14} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incidents…"
            className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
          />
        </div>
        {incidents === null ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState title="No incidents found" />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {filtered.map((inc) => (
              <button
                key={inc.id}
                onClick={() => navigate(`/investigate/${inc.id}`)}
                className="flex flex-col gap-1.5 border border-border bg-surface p-3 text-left hover:border-emerald"
              >
                <div className="flex items-center justify-between">
                  <span className="mono text-[11px] text-muted">{inc.id}</span>
                  <SeverityBadge severity={inc.severity} />
                </div>
                <div className="text-sm font-medium text-text">{inc.title}</div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{inc.alert_count} correlated alerts</span>
                  <StatusBadge status={inc.status} kind="incident" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InvestigationView({ incidentId }: { incidentId: string }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AlertiousEvent | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = () => {
    api.getIncident(incidentId).then(setIncident).catch((e) => setError(e.message));
  };

  useEffect(() => {
    setIncident(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  useEffect(() => {
    if (!incident || !incident.events || incident.events.length === 0) return;
    const primary = [...incident.events].sort(
      (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
    )[0];
    api.getGuidance(primary.id).then(setGuidance).catch(() => setGuidance(null));
  }, [incident]);

  if (error) return <ErrorState message={error} />;
  if (!incident) return <LoadingState label="Loading incident…" />;

  const events = incident.events ?? [];

  const updateStatus = async (status: string) => {
    setStatusSaving(true);
    try {
      const updated = await api.updateIncidentStatus(incidentId, status);
      setIncident(updated);
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div>
      <div className="border-b border-border px-5 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mono text-xs text-muted">{incident.id}</div>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold text-text">{incident.title}</h1>
              <SeverityBadge severity={incident.severity} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="border border-border bg-surface px-3 py-1.5 text-center">
              <div className="text-[10px] text-muted">Risk</div>
              <div className="mono text-lg font-semibold" style={{ color: SEVERITY_COLOR[incident.severity] }}>
                {incident.risk_score}/100
              </div>
            </div>
            <select
              value={incident.status}
              disabled={statusSaving}
              onChange={(e) => updateStatus(e.target.value)}
              className="border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:outline-none"
              aria-label="Incident status"
            >
              {INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <EntityChip label="Users" values={incident.users} />
          <EntityChip label="IPs" values={incident.source_ips} />
          <EntityChip label="Devices" values={incident.devices} />
        </div>

        {events.length > 0 && (
          <div className="mt-4">
            <SignalBars events={events} buckets={Math.max(8, Math.min(24, events.length * 3))} height={40} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 px-5 py-5 md:px-8 md:py-6 lg:grid-cols-5">
        {/* Timeline */}
        <div className="lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold text-text">Event timeline</h2>
          <div className="border border-border bg-surface p-4">
            <ol className="relative border-l border-blue/40 pl-5">
              {events.map((e, idx) => (
                <li key={e.id} className="mb-5 last:mb-0">
                  <span
                    className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
                    style={{ backgroundColor: SEVERITY_COLOR[e.severity] }}
                    aria-hidden="true"
                  />
                  <button
                    onClick={() => setSelectedEvent(e)}
                    className="w-full rounded-sm border border-transparent p-2 text-left hover:border-border hover:bg-surface2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="mono text-xs text-muted">{formatTimestamp(e.timestamp)}</span>
                      <SeverityBadge severity={e.severity} compact />
                    </div>
                    <div className="mt-0.5 font-medium text-text">{eventTypeLabel(e.event_type)}</div>
                    <div className="mt-0.5 mono text-[11px] text-muted">
                      {e.user ? `user: ${e.user}` : ""} {e.source_ip ? ` · ip: ${e.source_ip}` : ""} {e.device_id ? ` · device: ${e.device_id}` : ""}
                      {e.destination ? ` · dest: ${e.destination}` : ""}
                    </div>
                  </button>
                  {idx < events.length - 1 && (
                    <div className="ml-2 mt-1 text-[10px] text-blue/70">↓ correlated</div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right column: evidence, risk factors, guidance */}
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
              <ShieldQuestion size={15} className="text-blue" /> Why were these alerts grouped?
            </h2>
            <ul className="space-y-1.5 border border-border bg-surface p-3">
              {incident.correlation_evidence.length === 0 ? (
                <li className="text-xs text-muted">This alert has not been correlated with others.</li>
              ) : (
                incident.correlation_evidence.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald" />
                    {ev.description}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-text">Risk factors</h2>
            <ul className="space-y-1.5 border border-border bg-surface p-3">
              {incident.risk_factors.map((f, i) => (
                <li key={i} className="flex items-start justify-between gap-2 text-xs">
                  <div>
                    <div className="text-text">{f.label}</div>
                    <div className="text-muted">{f.reason}</div>
                  </div>
                  <span className="mono shrink-0 text-emerald">+{f.points}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-text">Response guidance</h2>
            <div className="space-y-3 border border-border bg-surface p-3 text-xs">
              {!guidance ? (
                <span className="text-muted">No guidance available.</span>
              ) : (
                <>
                  <div>
                    <div className="mb-1 text-xs font-semibold tracking-wide text-violet">Why it matters</div>
                    <p className="text-text">{guidance.why_it_matters}</p>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold tracking-wide text-violet">Recommended review</div>
                    <ol className="list-decimal space-y-1 pl-4 text-text">
                      {guidance.review_steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold tracking-wide text-violet">Possible resolution</div>
                    <ul className="list-disc space-y-1 pl-4 text-text">
                      {guidance.possible_resolution.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {selectedEvent && (
        <AlertDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => {
            setSelectedEvent(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#FF3D9A",
  HIGH: "#FF8A00",
  MEDIUM: "#FFD43B",
  LOW: "#87878F",
};

function EntityChip({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted">{label}</span>
      <span className="mono text-text">{values.join(", ")}</span>
    </div>
  );
}
