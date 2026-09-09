"""Explainable, deterministic risk scoring for incidents.

The score is a simple additive model, capped at 100. It is intentionally
transparent: every contributing factor is returned alongside the score so
the UI (and a technical reviewer) can see exactly why a number was chosen.
"""
from collections import Counter

from app.models.event import Event

SEVERITY_POINTS = {"LOW": 2, "MEDIUM": 6, "HIGH": 12, "CRITICAL": 18}

EVENT_TYPE_POINTS = {
    "PRIVILEGE_CHANGE": 20,
    "DATA_TRANSFER": 20,
    "FILE_ACCESS": 12,
    "NEW_DEVICE": 10,
    "NETWORK_CONNECTION": 6,
    "PROCESS_EXECUTION": 8,
}


def score_incident(events: list[Event]) -> tuple[int, list[dict]]:
    """Compute a 0-100 risk score for a set of correlated events.
    Returns (score, factors) where factors is a list of
    {"label": str, "points": int, "reason": str} used to render "risk factors".
    """
    factors: list[dict] = []
    total = 0.0

    type_counts = Counter(e.event_type for e in events)

    # Base points per severity present.
    sev_counts = Counter(e.severity for e in events)
    for sev, count in sev_counts.items():
        pts = SEVERITY_POINTS.get(sev, 0) * min(count, 3)  # diminishing returns after 3
        if pts:
            total += pts
            factors.append({
                "label": f"{sev.title()} severity events",
                "points": pts,
                "reason": f"{count} {sev} severity event(s) in this incident.",
            })

    # Points for specific high-signal event types occurring at all.
    for event_type, pts in EVENT_TYPE_POINTS.items():
        if type_counts.get(event_type):
            total += pts
            factors.append({
                "label": event_type.replace("_", " ").title(),
                "points": pts,
                "reason": f"{event_type.replace('_', ' ').title()} observed in this incident.",
            })

    # Repeated authentication failures.
    failed_logins = type_counts.get("LOGIN_FAILED", 0)
    if failed_logins >= 2:
        pts = min(15, failed_logins * 4)
        total += pts
        factors.append({
            "label": "Repeated authentication failures",
            "points": pts,
            "reason": f"{failed_logins} failed login attempts observed.",
        })

    # Successful login after failures - classic credential stuffing / takeover signal.
    if type_counts.get("LOGIN_FAILED", 0) >= 1 and type_counts.get("LOGIN_SUCCESS", 0) >= 1:
        total += 15
        factors.append({
            "label": "Success after failed logins",
            "points": 15,
            "reason": "A successful login followed one or more failed attempts.",
        })

    # Correlated volume: more distinct correlated events -> more confidence
    # this is a real sequence rather than noise.
    distinct_types = len(type_counts)
    if distinct_types >= 3:
        pts = min(17, (distinct_types - 2) * 6)
        total += pts
        factors.append({
            "label": "Multi-stage event sequence",
            "points": pts,
            "reason": f"{distinct_types} distinct event types correlated together, suggesting a multi-stage sequence.",
        })

    score = max(0, min(100, round(total)))
    factors.sort(key=lambda f: f["points"], reverse=True)
    return score, factors


def severity_from_score(score: int) -> str:
    if score >= 70:
        return "CRITICAL" if score >= 90 else "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"
