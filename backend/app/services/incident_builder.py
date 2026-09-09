"""Incident reconstruction.

Ties together the correlation engine and risk scoring: given a freshly
persisted event, decide whether it should join an existing incident, form a
brand-new incident with its correlated peers, or remain a standalone alert.
"""
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.incident import Incident
from app.services import correlation, risk_scoring

TITLE_RULES = [
    (lambda types: "PRIVILEGE_CHANGE" in types and "FILE_ACCESS" in types, "Possible Account Compromise"),
    (lambda types: "PRIVILEGE_CHANGE" in types and "DATA_TRANSFER" in types, "Potential Data Access Incident"),
    (lambda types: "LOGIN_FAILED" in types and "LOGIN_SUCCESS" in types, "Suspicious Authentication Sequence"),
    (lambda types: "PRIVILEGE_CHANGE" in types, "Privilege Escalation Activity"),
    (lambda types: "DATA_TRANSFER" in types, "Potential Data Access Incident"),
    (lambda types: "NEW_DEVICE" in types, "Unrecognized Device Activity"),
]


def generate_title(event_types: set[str]) -> str:
    for predicate, title in TITLE_RULES:
        if predicate(event_types):
            return title
    return "Correlated Security Activity"


def _merge_entity_list(existing: list[str] | None, new_values: list[str]) -> list[str]:
    values = set(existing or [])
    values.update(v for v in new_values if v)
    return sorted(values)


def _recompute_incident(db: Session, incident: Incident):
    events = list(incident.events)
    score, factors = risk_scoring.score_incident(events)
    incident.risk_score = score
    incident.risk_factors = factors
    incident.severity = risk_scoring.severity_from_score(score)
    incident.users = _merge_entity_list(None, [e.user for e in events])
    incident.source_ips = _merge_entity_list(None, [e.source_ip for e in events])
    incident.devices = _merge_entity_list(None, [e.device_id for e in events])
    event_types = {e.event_type for e in events}
    incident.title = generate_title(event_types)


def process_new_event(db: Session, event: Event) -> Incident | None:
    """Run correlation for `event` and update/create incidents accordingly.
    Returns the incident the event ended up in, or None if it stayed standalone.
    """
    correlated, evidence = correlation.correlate_event(db, event)

    if not correlated:
        return None

    # If any correlated event already belongs to an incident, join it
    # (preferring the most recently updated one if there are multiple).
    existing_incidents = [c.incident for c in correlated if c.incident is not None]
    target_incident: Incident | None = None
    if existing_incidents:
        target_incident = sorted(existing_incidents, key=lambda i: i.updated_at or i.created_at, reverse=True)[0]

    if target_incident is None:
        target_incident = Incident(status="OPEN", title="Correlated Security Activity")
        db.add(target_incident)
        db.flush()
        for c in correlated:
            c.incident_id = target_incident.id

    event.incident_id = target_incident.id

    # Merge evidence (dedupe by reason).
    existing_evidence = {e["reason"]: e for e in (target_incident.correlation_evidence or [])}
    for e in evidence:
        existing_evidence[e["reason"]] = e
    target_incident.correlation_evidence = list(existing_evidence.values())

    db.flush()
    db.refresh(target_incident)
    _recompute_incident(db, target_incident)
    db.flush()
    return target_incident
