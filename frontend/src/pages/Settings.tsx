import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { api } from "../services/api";

export default function Settings() {
  const [health, setHealth] = useState<{ status: string; simulated_environment: boolean } | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="System" title="Settings" description="About this environment." />
      <div className="max-w-2xl space-y-4 px-5 py-5 md:px-8 md:py-6">
        <div className="border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-text">Environment</h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted">API status</dt>
              <dd className="mono text-text">{health ? health.status : "unreachable"}</dd>
            </div>
            <div>
              <dt className="text-muted">Data source</dt>
              <dd className="text-text">Synthetic / simulated</dd>
            </div>
          </dl>
        </div>

        <div className="border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
          <h2 className="mb-2 text-sm font-semibold text-text">About Alertious</h2>
          <p>
            Alertious is a portfolio-grade security alert correlation and incident investigation prototype. It
            demonstrates event normalization, entity- and time-based correlation, explainable risk scoring, and
            contextual response guidance using deterministic backend logic — not a language model. All events and
            incidents in this environment are synthetic.
          </p>
        </div>
      </div>
    </div>
  );
}
