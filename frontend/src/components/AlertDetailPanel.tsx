import { useEffect, useState } from "react";
import { X, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { AlertiousEvent, Guidance } from "../types";
import SeverityBadge from "./SeverityBadge";
import { LoadingState, ErrorState } from "./States";
import { formatTimestamp, eventTypeLabel } from "../utils/format";

const ALERT_ACTIONS: { value: string; label: string }[] = [
  { value: "INVESTIGATING", label: "Mark Investigating" },
  { value: "EXPECTED", label: "Mark Expected" },
  { value: "RESOLVED", label: "Resolve" },
];

export default function AlertDetailPanel({ event, onClose, onUpdated }: { event: AlertiousEvent; onClose: () => void; onUpdated: (e: AlertiousEvent) => void }) {
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setGuidance(null);
    setError(null);
    api.getGuidance(event.id).then(setGuidance).catch((e) => setError(e.message));
  }, [event.id]);

  const applyStatus = async (status: string) => {
    setUpdating(status);
    try {
      const updated = await api.updateEventStatus(event.id, status);
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/80" role="dialog" aria-modal="true" aria-label="Alert details">
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-xs font-medium text-muted">Alert details</div>
            <div className="mt-1 flex items-center gap-2">
              <SeverityBadge severity={event.severity} />
              <span className="text-sm font-semibold text-text">{eventTypeLabel(event.event_type)}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close panel" className="rounded-sm p-1.5 text-muted hover:bg-surface2 hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4 text-sm">
          <dl className="grid grid-cols-2 gap-3 border border-border bg-surface2 p-3 mono text-xs">
            <div>
              <dt className="text-muted">Event ID</dt>
              <dd className="text-text">{event.id}</dd>
            </div>
            <div>
              <dt className="text-muted">Timestamp</dt>
              <dd className="text-text">{formatTimestamp(event.timestamp)}</dd>
            </div>
            <div>
              <dt className="text-muted">User</dt>
              <dd className="text-text">{event.user ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Source IP</dt>
              <dd className="text-text">{event.source_ip ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Device</dt>
              <dd className="text-text">{event.device_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Source</dt>
              <dd className="text-text">{event.source ?? "—"}</dd>
            </div>
          </dl>

          {error && <ErrorState message={error} />}

          {!guidance ? (
            <LoadingState label="Generating guidance…" />
          ) : (
            <>
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-violet">What happened</h3>
                <p className="text-text">{guidance.what_happened}</p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-violet">Why it matters</h3>
                <p className="text-text">{guidance.why_it_matters}</p>
              </section>

              {event.incident_id && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-violet">Related activity</h3>
                  <Link to={`/investigate/${event.incident_id}`} className="inline-flex items-center gap-1.5 text-blue hover:underline">
                    <Link2 size={13} /> View incident {event.incident_id}
                  </Link>
                </section>
              )}

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-violet">Recommended review</h3>
                <ol className="list-decimal space-y-1 pl-4 text-text">
                  {guidance.review_steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-violet">Possible resolution</h3>
                <ul className="list-disc space-y-1 pl-4 text-text">
                  {guidance.possible_resolution.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-surface px-5 py-3">
          {ALERT_ACTIONS.map((a) => {
            const hoverColor = a.value === "RESOLVED" ? "hover:border-mint hover:text-mint" : "hover:border-cyan hover:text-cyan";
            return (
              <button
                key={a.value}
                disabled={updating !== null || event.status === a.value}
                onClick={() => applyStatus(a.value)}
                className={`rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${hoverColor}`}
              >
                {updating === a.value ? "Saving…" : a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
