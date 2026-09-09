export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "NEW" | "INVESTIGATING" | "EXPECTED" | "RESOLVED";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";

export type EventType =
  | "LOGIN_FAILED"
  | "LOGIN_SUCCESS"
  | "NEW_DEVICE"
  | "PRIVILEGE_CHANGE"
  | "FILE_ACCESS"
  | "NETWORK_CONNECTION"
  | "PROCESS_EXECUTION"
  | "DATA_TRANSFER"
  | "LOGOUT";

export interface AlertiousEvent {
  id: string;
  timestamp: string | null;
  event_type: EventType;
  severity: Severity;
  user: string | null;
  source_ip: string | null;
  device_id: string | null;
  source: string | null;
  destination: string | null;
  metadata: Record<string, unknown>;
  status: AlertStatus;
  incident_id: string | null;
}

export interface RiskFactor {
  label: string;
  points: number;
  reason: string;
}

export interface CorrelationEvidence {
  reason: string;
  description: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  risk_score: number;
  risk_factors: RiskFactor[];
  users: string[];
  source_ips: string[];
  devices: string[];
  correlation_evidence: CorrelationEvidence[];
  alert_count: number;
  created_at: string | null;
  updated_at: string | null;
  events?: AlertiousEvent[];
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  weight: number;
}

export interface Stats {
  events_processed: number;
  events_correlated: number;
  correlation_rate: number;
  active_incidents: number;
  high_priority_incidents: number;
  events_last_24h: number;
}

export interface PaginatedEvents {
  items: AlertiousEvent[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Guidance {
  alert_id: string;
  what_happened: string;
  why_it_matters: string;
  review_steps: string[];
  possible_resolution: string[];
  severity: Severity;
}

export interface Scenario {
  id: string;
  name: string;
}
