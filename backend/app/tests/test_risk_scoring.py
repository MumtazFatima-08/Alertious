from datetime import datetime

from app.models.event import Event
from app.services.risk_scoring import score_incident, severity_from_score


def ev(**kwargs):
    defaults = dict(id="x", timestamp=datetime(2026, 1, 1), event_type="LOGIN_FAILED", severity="LOW")
    defaults.update(kwargs)
    return Event(**defaults)


def test_score_is_deterministic():
    events = [ev(id="1", event_type="LOGIN_FAILED"), ev(id="2", event_type="LOGIN_SUCCESS", severity="MEDIUM")]
    s1, f1 = score_incident(events)
    s2, f2 = score_incident(events)
    assert s1 == s2
    assert f1 == f2


def test_score_increases_with_privilege_escalation():
    base = [ev(id="1", event_type="LOGIN_SUCCESS")]
    escalated = base + [ev(id="2", event_type="PRIVILEGE_CHANGE", severity="HIGH")]
    s1, _ = score_incident(base)
    s2, _ = score_incident(escalated)
    assert s2 > s1


def test_score_capped_at_100():
    events = [ev(id=str(i), event_type=t, severity="CRITICAL") for i, t in enumerate(
        ["PRIVILEGE_CHANGE", "DATA_TRANSFER", "FILE_ACCESS", "NEW_DEVICE", "LOGIN_FAILED", "LOGIN_FAILED", "LOGIN_SUCCESS"]
    )]
    score, _ = score_incident(events)
    assert score <= 100


def test_severity_from_score_boundaries():
    assert severity_from_score(10) == "LOW"
    assert severity_from_score(40) == "MEDIUM"
    assert severity_from_score(75) == "HIGH"
    assert severity_from_score(95) == "CRITICAL"


def test_empty_events_score_zero():
    score, factors = score_incident([])
    assert score == 0
    assert factors == []
