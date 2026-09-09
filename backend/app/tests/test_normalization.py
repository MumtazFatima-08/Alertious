import pytest
from app.services.normalization import normalize_event, NormalizationError


def test_normalize_fills_default_severity():
    n = normalize_event({"event_type": "login_failed", "user": "alex"})
    assert n["event_type"] == "LOGIN_FAILED"
    assert n["severity"] == "LOW"


def test_normalize_rejects_unknown_event_type():
    with pytest.raises(NormalizationError):
        normalize_event({"event_type": "TELEPORT"})


def test_normalize_rejects_unknown_severity():
    with pytest.raises(NormalizationError):
        normalize_event({"event_type": "LOGIN_FAILED", "severity": "APOCALYPTIC"})


def test_normalize_strips_blank_strings_to_none():
    n = normalize_event({"event_type": "LOGIN_FAILED", "user": "   "})
    assert n["user"] is None


def test_normalize_missing_user_ip_device_ok():
    n = normalize_event({"event_type": "LOGIN_FAILED"})
    assert n["user"] is None
    assert n["source_ip"] is None
    assert n["device_id"] is None
