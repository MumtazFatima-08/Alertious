"""Synthetic event scenario simulator.

Generates sequences of synthetic events that are fed through the *same*
ingestion pipeline (normalize -> persist -> correlate -> build incident) as
any other event. Nothing here is a frontend-only animation - every event
produced here is a real row in the database.
"""
import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.services import normalization, incident_builder
from app.models.event import Event

SCENARIOS = {
    "credential_stuffing": "Credential Stuffing",
    "account_takeover": "Account Takeover",
    "privilege_escalation": "Privilege Escalation",
    "insider_activity": "Suspicious Insider Activity",
    "data_exfiltration": "Data Exfiltration",
    "normal_activity": "Normal User Activity",
}


def _rand_ip():
    return f"{random.randint(20,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"


def _rand_device():
    return "DEVICE-" + "".join(random.choices(string.digits, k=2))


def _users():
    return ["alex", "priya", "morgan", "sam", "jordan"]


def build_scenario_events(scenario: str, start_time: datetime | None = None) -> list[dict]:
    """Return a list of raw event payload dicts (unnormalized timestamps as
    datetimes) representing the chosen scenario, spaced out realistically.
    """
    start_time = start_time or datetime.now(timezone.utc)
    user = random.choice(_users())
    ip = _rand_ip()
    other_ip = _rand_ip()
    device = _rand_device()
    events: list[dict] = []

    def add(offset_seconds, event_type, severity=None, **kwargs):
        events.append({
            "timestamp": start_time + timedelta(seconds=offset_seconds),
            "event_type": event_type,
            "severity": severity,
            "user": user,
            "source": "simulator",
            **kwargs,
        })

    if scenario == "credential_stuffing":
        for i in range(5):
            add(i * 2, "LOGIN_FAILED", severity="LOW", source_ip=other_ip, device_id=device)
        add(11, "LOGIN_FAILED", severity="MEDIUM", source_ip=other_ip, device_id=device)

    elif scenario == "account_takeover":
        add(0, "LOGIN_FAILED", severity="LOW", source_ip=ip, device_id=device)
        add(2, "LOGIN_FAILED", severity="LOW", source_ip=ip, device_id=device)
        add(4, "LOGIN_FAILED", severity="LOW", source_ip=ip, device_id=device)
        add(100, "LOGIN_SUCCESS", severity="MEDIUM", source_ip=ip, device_id=device)
        add(180, "NEW_DEVICE", severity="MEDIUM", source_ip=ip, device_id=device)
        add(280, "PRIVILEGE_CHANGE", severity="HIGH", source_ip=ip, device_id=device, metadata={"new_role": "admin"})
        add(360, "FILE_ACCESS", severity="HIGH", source_ip=ip, device_id=device, destination="payroll.xlsx")

    elif scenario == "privilege_escalation":
        add(0, "LOGIN_SUCCESS", severity="LOW", source_ip=ip, device_id=device)
        add(60, "PRIVILEGE_CHANGE", severity="HIGH", source_ip=ip, device_id=device, metadata={"new_role": "admin"})
        add(150, "PROCESS_EXECUTION", severity="MEDIUM", source_ip=ip, device_id=device, metadata={"process": "powershell.exe"})

    elif scenario == "insider_activity":
        add(0, "LOGIN_SUCCESS", severity="LOW", source_ip=ip, device_id=device)
        add(120, "FILE_ACCESS", severity="MEDIUM", source_ip=ip, device_id=device, destination="hr_records.db")
        add(200, "FILE_ACCESS", severity="MEDIUM", source_ip=ip, device_id=device, destination="finance_reports.xlsx")
        add(260, "DATA_TRANSFER", severity="HIGH", source_ip=ip, device_id=device, destination="personal-drive.example.com")

    elif scenario == "data_exfiltration":
        add(0, "PRIVILEGE_CHANGE", severity="HIGH", source_ip=ip, device_id=device, metadata={"new_role": "admin"})
        add(90, "FILE_ACCESS", severity="HIGH", source_ip=ip, device_id=device, destination="customer_database.sql")
        add(150, "NETWORK_CONNECTION", severity="MEDIUM", source_ip=ip, device_id=device, destination="203.0.113.44")
        add(220, "DATA_TRANSFER", severity="CRITICAL", source_ip=ip, device_id=device, destination="203.0.113.44")

    else:  # normal_activity
        add(0, "LOGIN_SUCCESS", severity="LOW", source_ip=ip, device_id=device)
        add(300, "FILE_ACCESS", severity="LOW", source_ip=ip, device_id=device, destination="team_wiki.md")
        add(900, "LOGOUT", severity="LOW", source_ip=ip, device_id=device)

    return events


def run_scenario(db: Session, scenario: str) -> list[dict]:
    """Generate a scenario and push each event through the real pipeline.
    Returns the list of created event dicts (with incident linkage) in order.
    """
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Options: {list(SCENARIOS.keys())}")

    raw_events = build_scenario_events(scenario)
    created = []
    for raw in raw_events:
        normalized = normalization.normalize_event(raw)
        event = Event(**normalized)
        db.add(event)
        db.flush()
        incident_builder.process_new_event(db, event)
        db.commit()
        db.refresh(event)
        created.append(event.to_dict())
    return created
