import type {
  AlertiousEvent,
  Guidance,
  Incident,
  PaginatedEvents,
  Rule,
  Scenario,
  Stats,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ? JSON.stringify(body.detail) : detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string; simulated_environment: boolean }>("/health"),
  stats: () => request<Stats>("/stats"),

  listEvents: (params: {
    page?: number;
    page_size?: number;
    event_type?: string;
    severity?: string;
    user?: string;
    source_ip?: string;
    search?: string;
    sort?: string;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
    });
    return request<PaginatedEvents>(`/events?${qs.toString()}`);
  },
  getEvent: (id: string) => request<AlertiousEvent>(`/events/${id}`),
  getGuidance: (id: string) => request<Guidance>(`/events/${id}/guidance`),
  createEvent: (payload: Partial<AlertiousEvent>) =>
    request<AlertiousEvent>("/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEventStatus: (id: string, status: string) =>
    request<AlertiousEvent>(`/events/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  listIncidents: (params: { status?: string; severity?: string; search?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    return request<Incident[]>(`/incidents?${qs.toString()}`);
  },
  getIncident: (id: string) => request<Incident>(`/incidents/${id}`),
  updateIncidentStatus: (id: string, status: string) =>
    request<Incident>(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  listRules: () => request<Rule[]>("/rules"),
  updateRule: (id: string, payload: { enabled?: boolean; weight?: number }) =>
    request<Rule>(`/rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  listScenarios: () => request<Scenario[]>("/simulator/scenarios"),
  runScenario: (scenario: string) =>
    request<{ scenario: string; events_created: number; events: AlertiousEvent[] }>("/simulator/start", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    }),
};
