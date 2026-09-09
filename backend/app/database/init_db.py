from app.database.session import Base, engine, SessionLocal
from app.models import event, incident, rule  # noqa: F401 - register models
from app.models.rule import Rule

DEFAULT_RULES = [
    dict(id="same_user", name="Same User", description="Events involving the same user account are candidates for correlation.", category="entity", weight=15.0),
    dict(id="same_ip", name="Same IP", description="Events originating from the same source IP are candidates for correlation.", category="entity", weight=15.0),
    dict(id="same_device", name="Same Device", description="Events involving the same device are candidates for correlation.", category="entity", weight=12.0),
    dict(id="same_destination", name="Same Destination", description="Events sharing a destination resource or host are candidates for correlation.", category="entity", weight=8.0),
    dict(id="time_window", name="Time Window", description="Events sharing an entity that occur within a 7-minute window strengthen correlation confidence.", category="temporal", weight=10.0),
    dict(id="suspicious_sequence", name="Suspicious Sequence", description="A known escalation pattern (e.g. new device followed by privilege change) between two events.", category="sequence", weight=15.0),
    dict(id="failed_then_success", name="Failed Login \u2192 Success", description="A successful login following one or more failed attempts for the same account.", category="sequence", weight=15.0),
    dict(id="high_severity_context", name="High Severity Context", description="Correlated activity around a HIGH or CRITICAL severity event.", category="severity", weight=5.0),
]


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_ids = {r.id for r in db.query(Rule).all()}
        for r in DEFAULT_RULES:
            if r["id"] not in existing_ids:
                db.add(Rule(**r))
        db.commit()
    finally:
        db.close()
