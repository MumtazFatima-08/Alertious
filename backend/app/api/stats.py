from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app.database.session import get_db
from app.models.event import Event
from app.models.incident import Incident

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats(db: Session = Depends(get_db)):
    total_events = db.query(func.count(Event.id)).scalar() or 0
    correlated_events = db.query(func.count(Event.id)).filter(Event.incident_id.isnot(None)).scalar() or 0
    active_incidents = db.query(func.count(Incident.id)).filter(Incident.status.in_(["OPEN", "INVESTIGATING"])).scalar() or 0
    high_priority = db.query(func.count(Incident.id)).filter(
        Incident.status.in_(["OPEN", "INVESTIGATING"]), Incident.severity.in_(["HIGH", "CRITICAL"])
    ).scalar() or 0

    correlation_rate = round((correlated_events / total_events) * 100, 1) if total_events else 0.0

    recent_cutoff = datetime.utcnow() - timedelta(hours=24)
    events_24h = db.query(func.count(Event.id)).filter(Event.timestamp >= recent_cutoff).scalar() or 0

    return {
        "events_processed": total_events,
        "events_correlated": correlated_events,
        "correlation_rate": correlation_rate,
        "active_incidents": active_incidents,
        "high_priority_incidents": high_priority,
        "events_last_24h": events_24h,
    }
