import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayCircle, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import type { AlertiousEvent, Scenario } from "../types";
import PageHeader from "../components/PageHeader";
import SeverityBadge from "../components/SeverityBadge";
import { LoadingState, ErrorState } from "../components/States";
import { eventTypeLabel, formatClock } from "../utils/format";

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  credential_stuffing: "A burst of failed login attempts against a single account from one source — no successful access.",
  account_takeover: "Failed logins, then a successful login, a new device, privilege escalation, and sensitive file access.",
  privilege_escalation: "A normal login immediately followed by an unauthorized-looking privilege change and process execution.",
  insider_activity: "A legitimate session that accesses multiple sensitive files followed by an external data transfer.",
  data_exfiltration: "Privilege escalation followed by sensitive database access, an external connection, and a large transfer.",
  normal_activity: "Routine login, file access, and logout — should stay low risk and may not form an incident at all.",
};

export default function Simulator() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ scenario: string; events: AlertiousEvent[] } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listScenarios().then(setScenarios).catch((e) => setError(e.message));
  }, []);

  const run = async (id: string) => {
    setRunning(id);
    setError(null);
    setResult(null);
    try {
      const res = await api.runScenario(id);
      setResult({ scenario: id, events: res.events });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  const incidentIds = Array.from(new Set((result?.events ?? []).map((e) => e.incident_id).filter(Boolean))) as string[];

  return (
    <div>
      <PageHeader
        eyebrow="Synthetic environment"
        title="Simulator"
        description="Generates synthetic events that flow through the real ingestion pipeline: normalize → persist → correlate → build incident → risk score."
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        {error && <ErrorState message={error} />}
        {scenarios === null ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {scenarios.map((s) => (
              <div key={s.id} className="flex flex-col justify-between gap-3 border border-border bg-surface p-4">
                <div>
                  <div className="text-sm font-semibold text-text">{s.name}</div>
                  <p className="mt-1 text-xs text-muted">{SCENARIO_DESCRIPTIONS[s.id] ?? "Synthetic scenario."}</p>
                </div>
                <button
                  onClick={() => run(s.id)}
                  disabled={running !== null}
                  className="flex items-center justify-center gap-1.5 self-start border border-cyan px-3 py-1.5 text-xs font-medium text-cyan transition-colors hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PlayCircle size={14} />
                  {running === s.id ? "Running…" : "Run scenario"}
                </button>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-text">
              Generated events — {scenarios?.find((s) => s.id === result.scenario)?.name}
            </h2>
            <div className="border border-border bg-surface">
              <ol>
                {result.events.map((e) => (
                  <li key={e.id} className="enter-row flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="mono w-20 shrink-0 text-xs text-muted">{formatClock(e.timestamp)}</span>
                      <span className="text-sm text-text">{eventTypeLabel(e.event_type)}</span>
                      <SeverityBadge severity={e.severity} compact />
                    </div>
                    {e.incident_id ? (
                      <span className="mono shrink-0 text-xs text-blue">→ {e.incident_id}</span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted">standalone</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {incidentIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {incidentIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => navigate(`/investigate/${id}`)}
                    className="flex items-center gap-1.5 border border-blue/40 px-3 py-1.5 text-xs text-blue hover:bg-blue/10"
                  >
                    Open incident {id} <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
