# Alertious

**From alerts to incidents.**

Alertious is a portfolio-grade security alert correlation and incident
investigation prototype. It demonstrates event normalization, entity- and
time-based correlation, deterministic incident reconstruction, explainable
risk scoring, and contextual response guidance — all built on transparent,
rule-based backend logic, not a language model.

It is not a replacement for Microsoft Sentinel, Splunk, CrowdStrike, Palo
Alto products, or AWS security services. It is a demonstration of how those
systems' core reasoning — "why do these alerts belong together, and what
should an analyst do about it" — can be built and explained from first
principles.

---

## 1. Problem

Security tooling generates a large volume of individual alerts. Most, in
isolation, are low-signal: a single failed login, a new device, a file
open. The security-relevant story usually isn't any one alert — it's the
*sequence*:

```
FAILED LOGIN → FAILED LOGIN → SUCCESSFUL LOGIN → NEW DEVICE
  → PRIVILEGE ESCALATION → SENSITIVE FILE ACCESS
```

Individually, none of these alerts justifies analyst attention. Together,
they describe a plausible account compromise. Alertious's job is to turn a
stream of raw events into that story automatically, explain *why* it drew
the connections it did, and tell an analyst what to check next.

## 2. Why Alertious

Most portfolio security projects either (a) render a static dashboard over
fake numbers, or (b) wrap an LLM prompt and call the output "detection."
Alertious is built around a different bet: that the interesting engineering
problem in this space is the correlation and explainability layer, and that
it should be fully deterministic so every decision can be audited. If a
reviewer asks "why did the system decide these seven events were one
incident?", the answer should be a list of named rules and their weights —
never "the model said so."

## 3. Architecture

```
Event Source (API / Simulator)
        │
        ▼
  Normalization  ── validates event_type/severity, fills defaults,
        │            coerces timestamps to a consistent UTC representation
        ▼
   Persistence   ── SQLite via SQLAlchemy
        │
        ▼
Correlation Engine ── scans a recent time window for events sharing an
        │              entity (user / IP / device / destination) with the
        │              new event, and scores each candidate pair against
        │              enabled correlation rules
        ▼
 Incident Builder ── creates a new incident or attaches to an existing one,
        │             merges entities, records evidence, regenerates title
        ▼
  Risk Scoring    ── additive, explainable 0–100 score with named factors
        │
        ▼
Response Guidance ── deterministic, event-type + context-aware review /
        │             resolution guidance
        ▼
 Investigation UI  ── timeline, evidence, risk factors, guidance, actions
```

Every stage is a plain Python function or class in `backend/app/services/`,
independently unit-tested. The frontend never computes or hardcodes any of
this — it only renders what the API returns.

## 4. Event schema

```json
{
  "id": "EVT-a1b2c3d4",
  "timestamp": "2026-01-01T09:00:00",
  "event_type": "LOGIN_FAILED",
  "severity": "LOW",
  "user": "alex",
  "source_ip": "185.23.10.4",
  "device_id": "DEVICE-42",
  "source": "auth-service",
  "destination": null,
  "metadata": {},
  "status": "NEW",
  "incident_id": null
}
```

Supported `event_type` values: `LOGIN_FAILED`, `LOGIN_SUCCESS`,
`NEW_DEVICE`, `PRIVILEGE_CHANGE`, `FILE_ACCESS`, `NETWORK_CONNECTION`,
`PROCESS_EXECUTION`, `DATA_TRANSFER`, `LOGOUT`.

## 5. Correlation engine

Implemented in `backend/app/services/correlation.py`. For every new event,
the engine:

1. Looks back up to 60 minutes for events sharing the same user, source IP,
   or device.
2. For each candidate, sums the weights of every **enabled** rule whose
   condition matches between the two events:
   - `same_user`, `same_ip`, `same_device`, `same_destination` — shared entity
   - `time_window` — both events occurred within a 7-minute window
     (only counted alongside a shared entity, so coincidental timing between
     unrelated events is never scored)
   - `suspicious_sequence` — the pair matches a known escalation pattern
     (e.g. `NEW_DEVICE → PRIVILEGE_CHANGE`)
   - `failed_then_success` — a successful login following failed attempts
     for the same account
   - `high_severity_context` — either event is HIGH/CRITICAL severity
3. If the pairwise score reaches the correlation threshold (30 points), the
   two events are correlated, and the specific matched rules are recorded as
   evidence.

All rule weights and enabled/disabled state are stored in the `rules` table
and are live-editable from the Rules page — disabling a rule immediately
changes correlation behavior for every subsequent event, with no code
changes or restart required.

## 6. Incident reconstruction

`backend/app/services/incident_builder.py` decides, for a correlated event,
whether to:

- join an existing incident (preferring the most recently updated one if
  more than one candidate already belongs to an incident), or
- create a new incident from the event and its correlated peers.

The incident's title, involved entities, and severity are recomputed from
its actual member events every time it changes — never hand-written. Title
selection is a small deterministic rule table (e.g. "privilege change +
file access" → *Possible Account Compromise*), not a generative model.

## 7. Risk scoring

`backend/app/services/risk_scoring.py` computes an additive, capped 0–100
score from the incident's member events:

- Points per severity level present (diminishing after 3 of the same
  severity)
- Fixed points for specific high-signal event types (privilege change, data
  transfer, sensitive file access, new device, etc.)
- Extra points for repeated authentication failures
- Extra points for a successful login following failures
- Extra points for a multi-stage sequence (3+ distinct event types
  correlated together)

Every contributing factor is returned as a `{label, points, reason}` object
and rendered directly in the Investigation view — nothing is summarized
away.

## 8. Response guidance

`backend/app/services/response_guidance.py` is a template-driven, per
event-type engine that returns:

- **What happened** — plain-language description of the event
- **Why it matters** — the security rationale, augmented with incident
  context when the alert is correlated
- **Recommended review** — specific, actionable checks (never "investigate
  the issue")
- **Possible resolution** — human-reviewed, non-destructive suggestions only

Alertious never recommends or performs automatic destructive actions
(disabling accounts, blocking IPs, killing processes, deleting data). All
guidance is explicitly framed as something a human analyst reviews and
approves.

## 9. Simulator

`backend/app/services/simulator.py` generates six synthetic scenarios
(`credential_stuffing`, `account_takeover`, `privilege_escalation`,
`insider_activity`, `data_exfiltration`, `normal_activity`). Every event
the simulator produces is pushed through the exact same
normalize → persist → correlate → build-incident pipeline as any other
event — there is no separate "demo mode" logic and no frontend-only
animation faking the effect.

## 10. Tech stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, lucide-react
- **Backend:** Python, FastAPI, Pydantic
- **Database:** SQLite + SQLAlchemy
- **Testing:** pytest (backend), tsc + vite build (frontend)

## 11. Project structure

```
backend/
  app/
    main.py
    api/            events.py, incidents.py, rules.py, simulator.py, stats.py
    models/         event.py, incident.py, rule.py
    schemas/        event.py, incident.py, rule.py
    services/       normalization.py, correlation.py, incident_builder.py,
                     risk_scoring.py, response_guidance.py, simulator.py
    database/       session.py, init_db.py, seed.py
    tests/
frontend/
  src/
    components/     SeverityBadge, StatusBadge, AlertDetailPanel, ...
    pages/          Overview, Incidents, Events, Investigate, Rules, Simulator, Settings
    layouts/        AppLayout (sidebar navigation + live status)
    services/       api.ts (typed fetch client)
    hooks/          useLiveEvents.ts (SSE subscription)
    types/          shared TypeScript types mirroring backend schemas
    utils/          formatting helpers
```

## 12. API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/stats` | Operational metrics (events processed, correlation rate, active/high-priority incidents) |
| GET | `/api/events` | Paginated, filterable, sortable event list |
| GET | `/api/events/{id}` | Single event detail |
| GET | `/api/events/{id}/guidance` | Contextual response guidance for one event |
| GET | `/api/events/{id}/evidence` | Correlation evidence for the event's incident, if any |
| POST | `/api/events` | Ingest a new event through the full pipeline |
| PATCH | `/api/events/{id}/status` | Update alert status (`INVESTIGATING`, `EXPECTED`, `RESOLVED`) |
| GET | `/api/incidents` | Filterable, sortable incident list |
| GET | `/api/incidents/{id}` | Single incident with full event timeline |
| PATCH | `/api/incidents/{id}` | Update incident status |
| GET | `/api/rules` | List correlation rules |
| PATCH | `/api/rules/{id}` | Toggle a rule or change its weight |
| GET | `/api/simulator/scenarios` | List available scenarios |
| POST | `/api/simulator/start` | Run a scenario through the real pipeline |
| GET | `/api/events/stream` | Server-Sent Events stream of newly created events |

## 13. Testing

37 backend tests in `backend/app/tests/`, covering:

- Normalization (defaults, invalid types/severities, blank fields)
- Correlation by same user / IP / device, time-window expiry, sequence
  detection, disabled-rule behavior, unrelated events, missing entities
- Risk scoring determinism, escalation sensitivity, capping, boundaries
- Response guidance content and a check that no guidance ever recommends a
  destructive action
- API-level: pagination, event/incident status updates, rule toggling
  actually changing correlation outcomes, simulator execution through the
  real pipeline, and a regression test for route registration order (an
  earlier bug where `/api/events/stream` was shadowed by the
  `/api/events/{event_id}` wildcard route)

Run them with:

```bash
cd backend
pip install -r requirements.txt
python -m pytest app/tests -q
```

Frontend type-safety and build are checked with:

```bash
cd frontend
npm install
npx tsc -b
npm run build
```

## 14. Running it locally

```bash
# backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to `localhost:8000` (see
`vite.config.ts`). On first backend startup the database is created and
seeded with a realistic synthetic dataset — the app never opens to an empty
screen.

## 15. Limitations

- The correlation engine only considers events sharing an explicit entity
  (user, IP, device, or destination); it does not attempt statistical
  anomaly detection or baselining of "normal" behavior per user.
- The simulator's scenarios are fixed, hand-designed sequences rather than
  a general-purpose attack-graph generator.
- SQLite and a single-process FastAPI app are appropriate for a local demo,
  not for production ingestion volume.
- There is no authentication/authorization layer; this is a local
  investigation-workspace prototype, not a multi-tenant product.
- The "same destination" and sequence rules use a small fixed vocabulary of
  event types and escalation pairs rather than a learned or configurable
  graph.

## 16. Future improvements

- Pluggable correlation rules (load rule definitions from a config file or
  admin UI rather than a fixed Python rule table)
- Per-user behavioral baselining to reduce false positives on routine
  activity
- A proper background job runner for the simulator instead of synchronous
  execution per request
- Multi-incident merge/split tooling for analysts
- Role-based access control and audit logging of analyst actions
- Postgres support for realistic ingestion volume

## 17. Visual design notes

The UI ships with a deep-black, multi-accent visual identity: a near-true
black environment (`#050505`), white/off-white typography, and color used
strictly for meaning rather than decoration — cyan for live/system status
and primary interaction, electric blue for correlation relationships,
violet for guidance and analysis content, and magenta/orange/yellow for
critical/high/medium severity. This is a styling layer only: every page,
route, component, and API integration is unchanged from the functional
description above. The "signal activity" visualizations on the Overview
and Investigate pages are direct, bucketed renderings of real event data
returned by the API — not decorative placeholders.
