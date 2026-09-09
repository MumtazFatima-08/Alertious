from datetime import datetime
from app.models.event import Event
from app.services.response_guidance import build_guidance


def test_guidance_for_failed_login():
    e = Event(id="e1", timestamp=datetime(2026, 1, 1), event_type="LOGIN_FAILED", severity="LOW")
    g = build_guidance(e, None, [])
    assert g["alert_id"] == "e1"
    assert "credential stuffing" in g["why_it_matters"].lower()
    assert len(g["review_steps"]) >= 3
    assert len(g["possible_resolution"]) >= 1


def test_guidance_for_privilege_change_mentions_authorization():
    e = Event(id="e2", timestamp=datetime(2026, 1, 1), event_type="PRIVILEGE_CHANGE", severity="HIGH")
    g = build_guidance(e, None, [])
    assert any("authoriz" in step.lower() for step in g["review_steps"])


def test_guidance_never_recommends_destructive_action():
    destructive_terms = ["delete", "terminate the process", "disable the account now", "kill process"]
    for event_type in ["LOGIN_FAILED", "PRIVILEGE_CHANGE", "FILE_ACCESS", "DATA_TRANSFER", "PROCESS_EXECUTION"]:
        e = Event(id="e", timestamp=datetime(2026, 1, 1), event_type=event_type, severity="HIGH")
        g = build_guidance(e, None, [])
        full_text = " ".join(g["review_steps"] + g["possible_resolution"]).lower()
        for term in destructive_terms:
            assert term not in full_text
