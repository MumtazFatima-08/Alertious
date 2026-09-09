"""The correlation engine.

This is the central engineering piece of Alertious. It is fully
deterministic and rule-based - no LLM involved.

How it works
------------
When a new normalized event is persisted, we look back over a configurable
time window (default 15 minutes) for other *recent* events that share an
entity (same user, IP, or device) with the new event, or that plausibly
continue an attack sequence (e.g. LOGIN_FAILED -> LOGIN_SUCCESS).

For every such candidate event we compute a "pairwise correlation score" by
summing the weights of every enabled rule whose condition matches between
the new event and the candidate. If the *best* pairwise score reaches the
correlation threshold, the two events are considered correlated.

Once we know which recent events correlate with the new one, we either:
  - attach the new event to an existing incident that any of those events
    already belong to, or
  - create a brand-new incident containing the new event + the correlated
    candidates (if none of them already belong to an incident).

Every grouping decision produces a human-readable evidence trail
(`correlation_evidence`) that is stored on the incident and rendered by the
frontend - nothing is invented after the fact.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.incident import Incident
from app.models.rule import Rule

# How far back (in minutes) we look for correlation candidates. This is a
# ceiling; the actual "same window" rule uses the configurable rule weight
# and a tighter default window (see RULE_TIME_WINDOW_MINUTES) but we still
# need *some* bound on how much history to scan for performance.
LOOKBACK_MINUTES = 60

# Default time window (minutes) used by the "time_window" rule itself.
RULE_TIME_WINDOW_MINUTES = 7

# Minimum pairwise score for two events to be considered correlated.
CORRELATION_THRESHOLD = 30.0

# Escalation sequences that indicate a plausible attack progression.
# Each tuple (A, B) means "B following A is suspicious".
SUSPICIOUS_SEQUENCES = {
    ("LOGIN_FAILED", "LOGIN_SUCCESS"),
    ("LOGIN_SUCCESS", "NEW_DEVICE"),
    ("NEW_DEVICE", "PRIVILEGE_CHANGE"),
    ("LOGIN_SUCCESS", "PRIVILEGE_CHANGE"),
    ("PRIVILEGE_CHANGE", "FILE_ACCESS"),
    ("FILE_ACCESS", "DATA_TRANSFER"),
    ("PRIVILEGE_CHANGE", "DATA_TRANSFER"),
    ("NEW_DEVICE", "FILE_ACCESS"),
}


@dataclass
class MatchResult:
    score: float
    reasons: list[dict] = field(default_factory=list)  # [{rule_id, description, points}]


def _get_rule_map(db: Session) -> dict[str, Rule]:
    return {r.id: r for r in db.query(Rule).all()}


def _rule_weight(rules: dict[str, Rule], rule_id: str) -> float:
    r = rules.get(rule_id)
    if r is None or not r.enabled:
        return 0.0
    return r.weight


def evaluate_pair(new_event: Event, candidate: Event, rules: dict[str, Rule]) -> MatchResult:
    """Compute the pairwise correlation score/evidence between two events,
    honoring which rules are currently enabled and their configured weights.
    """
    result = MatchResult(score=0.0)

    if candidate.id == new_event.id:
        return result

    def add(rule_id: str, description: str):
        w = _rule_weight(rules, rule_id)
        if w > 0:
            result.score += w
            result.reasons.append({"rule": rule_id, "description": description, "points": w})

    if new_event.user and candidate.user and new_event.user == candidate.user:
        add("same_user", f"Both events involved the same user ({new_event.user}).")

    if new_event.source_ip and candidate.source_ip and new_event.source_ip == candidate.source_ip:
        add("same_ip", f"Both events originated from the same source IP ({new_event.source_ip}).")

    if new_event.device_id and candidate.device_id and new_event.device_id == candidate.device_id:
        add("same_device", f"Both events involved the same device ({new_event.device_id}).")

    if new_event.destination and candidate.destination and new_event.destination == candidate.destination:
        add("same_destination", f"Both events involved the same destination ({new_event.destination}).")

    # Time window: only counts if the events also share at least one entity,
    # otherwise coincidental timing between unrelated events would be noise.
    shares_entity = any([
        new_event.user and candidate.user and new_event.user == candidate.user,
        new_event.source_ip and candidate.source_ip and new_event.source_ip == candidate.source_ip,
        new_event.device_id and candidate.device_id and new_event.device_id == candidate.device_id,
    ])
    if shares_entity:
        delta = abs((new_event.timestamp - candidate.timestamp).total_seconds()) / 60.0
        if delta <= RULE_TIME_WINDOW_MINUTES:
            add("time_window", f"Both events occurred within a {RULE_TIME_WINDOW_MINUTES}-minute window ({delta:.1f} min apart).")

    # Sequence: does candidate -> new_event (in time order) form a known
    # escalation pattern, e.g. LOGIN_FAILED -> LOGIN_SUCCESS?
    if shares_entity:
        earlier, later = (candidate, new_event) if candidate.timestamp <= new_event.timestamp else (new_event, candidate)
        pair = (earlier.event_type, later.event_type)
        if pair in SUSPICIOUS_SEQUENCES:
            add("suspicious_sequence", f"Sequential escalation pattern detected: {earlier.event_type} followed by {later.event_type}.")

    # Failed-login-to-success is specifically valuable enough to weight on
    # its own even without the generic sequence rule catching it.
    if shares_entity and {new_event.event_type, candidate.event_type} == {"LOGIN_FAILED", "LOGIN_SUCCESS"}:
        add("failed_then_success", "A successful login followed repeated authentication failures for the same account.")

    # Severity: if either event is HIGH/CRITICAL, correlated activity around
    # it is more meaningful.
    if new_event.severity in ("HIGH", "CRITICAL") or candidate.severity in ("HIGH", "CRITICAL"):
        add("high_severity_context", "One of the correlated events carries HIGH/CRITICAL severity.")

    return result


def find_candidates(db: Session, new_event: Event) -> list[Event]:
    """Fetch recent events that share at least one entity with new_event,
    bounded by LOOKBACK_MINUTES, excluding the event itself.
    """
    lower_bound = new_event.timestamp - timedelta(minutes=LOOKBACK_MINUTES)
    upper_bound = new_event.timestamp + timedelta(minutes=LOOKBACK_MINUTES)

    filters = []
    if new_event.user:
        filters.append(Event.user == new_event.user)
    if new_event.source_ip:
        filters.append(Event.source_ip == new_event.source_ip)
    if new_event.device_id:
        filters.append(Event.device_id == new_event.device_id)

    if not filters:
        return []

    from sqlalchemy import or_

    query = (
        db.query(Event)
        .filter(Event.id != new_event.id)
        .filter(Event.timestamp >= lower_bound)
        .filter(Event.timestamp <= upper_bound)
        .filter(or_(*filters))
        .order_by(Event.timestamp.asc())
    )
    return query.all()


def correlate_event(db: Session, new_event: Event) -> tuple[list[Event], list[dict]]:
    """Return (correlated_candidate_events, merged_evidence) for new_event.
    Does not mutate the database - callers (incident_builder) decide what
    to do with the result.
    """
    rules = _get_rule_map(db)
    candidates = find_candidates(db, new_event)

    correlated: list[Event] = []
    evidence_by_reason: dict[str, dict] = {}

    for candidate in candidates:
        match = evaluate_pair(new_event, candidate, rules)
        if match.score >= CORRELATION_THRESHOLD:
            correlated.append(candidate)
            for reason in match.reasons:
                key = reason["rule"]
                if key not in evidence_by_reason:
                    evidence_by_reason[key] = {
                        "reason": key,
                        "description": reason["description"],
                    }

    return correlated, list(evidence_by_reason.values())
