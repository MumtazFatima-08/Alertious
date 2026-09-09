import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Rule } from "../types";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

const CATEGORY_LABEL: Record<string, string> = {
  entity: "Entity correlation",
  temporal: "Temporal correlation",
  sequence: "Sequence correlation",
  severity: "Severity context",
};

export default function Rules() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => api.listRules().then(setRules).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const toggle = async (rule: Rule) => {
    setSaving(rule.id);
    try {
      const updated = await api.updateRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => (prev ? prev.map((r) => (r.id === rule.id ? updated : r)) : prev));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const changeWeight = async (rule: Rule, weight: number) => {
    setRules((prev) => (prev ? prev.map((r) => (r.id === rule.id ? { ...r, weight } : r)) : prev));
  };

  const commitWeight = async (rule: Rule, weight: number) => {
    setSaving(rule.id);
    try {
      const updated = await api.updateRule(rule.id, { weight });
      setRules((prev) => (prev ? prev.map((r) => (r.id === rule.id ? updated : r)) : prev));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (error) return <ErrorState message={error} />;

  const grouped = (rules ?? []).reduce<Record<string, Rule[]>>((acc, r) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow="Correlation engine"
        title="Rules"
        description="Each rule contributes weighted points toward the correlation score. Disabling a rule removes its contribution immediately across the engine — try it, then run a scenario in the Simulator to see the effect."
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        {rules === null ? (
          <LoadingState />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryRules]) => (
              <div key={category}>
                <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted">
                  {CATEGORY_LABEL[category] ?? category}
                </h2>
                <div className="divide-y divide-border border border-border bg-surface">
                  {categoryRules.map((rule) => (
                    <div key={rule.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-text">{rule.name}</div>
                        <div className="text-xs text-muted">{rule.description}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`weight-${rule.id}`} className="text-[11px] text-muted">
                            Weight
                          </label>
                          <input
                            id={`weight-${rule.id}`}
                            type="number"
                            min={0}
                            max={100}
                            value={rule.weight}
                            disabled={!rule.enabled || saving === rule.id}
                            onChange={(e) => changeWeight(rule, Number(e.target.value))}
                            onBlur={(e) => commitWeight(rule, Number(e.target.value))}
                            className="mono w-16 border border-border bg-surface2 px-2 py-1 text-xs text-text focus:outline-none disabled:opacity-40"
                          />
                        </div>
                        <button
                          role="switch"
                          aria-checked={rule.enabled}
                          aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                          disabled={saving === rule.id}
                          onClick={() => toggle(rule)}
                          className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                            rule.enabled ? "border-cyan bg-cyan/25" : "border-border bg-surface2"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform ${
                              rule.enabled ? "bg-cyan" : "bg-muted"
                            }`}
                            style={{ transform: rule.enabled ? "translateX(18px)" : "translateX(2px)", boxShadow: rule.enabled ? "0 0 6px #00E5FF99" : undefined }}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
