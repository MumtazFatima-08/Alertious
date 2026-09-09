from datetime import datetime, timedelta

from app.models.event import Event
from app.models.rule import Rule
from app.services import normalization, incident_builder, correlation


def make_event(db, **kwargs):
    defaults = dict(timestamp=datetime(2026, 1, 1, 9, 0, 0), event_type="LOGIN_FAILED", severity="LOW", source="test")
    defaults.update(kwargs)
    normalized = normalization.normalize_event(defaults)
    e = Event(**normalized)
    db.add(e)
    db.flush()
    return e


def test_correlation_by_same_user(db_session):
    e1 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1", event_type="LOGIN_FAILED",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)

    e2 = make_event(db_session, user="alex", source_ip="2.2.2.2", device_id="D2", event_type="LOGIN_SUCCESS",
                     timestamp=datetime(2026, 1, 1, 9, 1, 0))
    incident = incident_builder.process_new_event(db_session, e2)

    assert incident is not None
    assert e2.incident_id == e1.incident_id


def test_correlation_by_same_ip(db_session):
    e1 = make_event(db_session, user="u1", source_ip="9.9.9.9", device_id="D1",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="u2", source_ip="9.9.9.9", device_id="D2", event_type="LOGIN_SUCCESS",
                     timestamp=datetime(2026, 1, 1, 9, 2, 0))
    incident = incident_builder.process_new_event(db_session, e2)
    assert incident is not None


def test_correlation_by_same_device(db_session):
    e1 = make_event(db_session, user="u1", source_ip="1.1.1.1", device_id="SHARED",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="u2", source_ip="2.2.2.2", device_id="SHARED", event_type="LOGIN_SUCCESS",
                     timestamp=datetime(2026, 1, 1, 9, 3, 0))
    incident = incident_builder.process_new_event(db_session, e2)
    assert incident is not None


def test_time_window_prevents_stale_correlation(db_session):
    """Events sharing an entity but far outside the time window (and with no
    other correlating signal) should not correlate."""
    e1 = make_event(db_session, user="alex", event_type="LOGIN_FAILED", severity="LOW",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="alex", event_type="LOGOUT", severity="LOW",
                     timestamp=datetime(2026, 1, 1, 9, 55, 0))  # 55 min later, outside lookback
    incident = incident_builder.process_new_event(db_session, e2)
    assert incident is None


def test_event_sequence_correlation(db_session):
    e1 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1", event_type="NEW_DEVICE", severity="MEDIUM",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1", event_type="PRIVILEGE_CHANGE", severity="HIGH",
                     timestamp=datetime(2026, 1, 1, 9, 2, 0))
    incident = incident_builder.process_new_event(db_session, e2)
    assert incident is not None
    reasons = {r["reason"] for r in incident.correlation_evidence}
    assert "suspicious_sequence" in reasons


def test_disabled_rule_prevents_correlation(db_session):
    # Disable every rule except nothing - correlation should then fail even
    # for two events sharing user/ip/device within the window.
    for rule in db_session.query(Rule).all():
        rule.enabled = False
    db_session.commit()

    e1 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1", event_type="LOGIN_SUCCESS",
                     timestamp=datetime(2026, 1, 1, 9, 1, 0))
    incident = incident_builder.process_new_event(db_session, e2)
    assert incident is None


def test_unrelated_events_do_not_correlate(db_session):
    e1 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="someone_else", source_ip="9.9.9.9", device_id="D9",
                     timestamp=datetime(2026, 1, 1, 9, 0, 30))
    incident = incident_builder.process_new_event(db_session, e2)
    assert incident is None


def test_adding_third_event_joins_same_incident(db_session):
    e1 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident_builder.process_new_event(db_session, e1)
    e2 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1", event_type="LOGIN_SUCCESS",
                     timestamp=datetime(2026, 1, 1, 9, 1, 0))
    inc1 = incident_builder.process_new_event(db_session, e2)
    e3 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1", event_type="NEW_DEVICE", severity="MEDIUM",
                     timestamp=datetime(2026, 1, 1, 9, 2, 0))
    inc2 = incident_builder.process_new_event(db_session, e3)
    assert inc1.id == inc2.id
    assert len(inc2.events) == 3


def test_missing_entities_do_not_crash(db_session):
    e1 = make_event(db_session, user=None, source_ip=None, device_id=None,
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    incident = incident_builder.process_new_event(db_session, e1)
    assert incident is None  # no entity to correlate on


def test_duplicate_event_payload_creates_distinct_records(db_session):
    e1 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    e2 = make_event(db_session, user="alex", source_ip="1.1.1.1", device_id="D1",
                     timestamp=datetime(2026, 1, 1, 9, 0, 0))
    assert e1.id != e2.id
