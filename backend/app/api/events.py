from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.database.session import get_db
from app.models.event import Event, ALERT_STATUSES
from app.models.incident import Incident
from app.schemas.event import EventCreate, EventStatusUpdate, ResponseGuidance
from app.services import normalization, incident_builder, response_guidance, correlation

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("")
def list_events(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    event_type: str | None = None,
    severity: str | None = None,
    user: str | None = None,
    source_ip: str | None = None,
    search: str | None = None,
    sort: str = Query("timestamp_desc"),
):
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if severity:
        query = query.filter(Event.severity == severity)
    if user:
        query = query.filter(Event.user == user)
    if source_ip:
        query = query.filter(Event.source_ip == source_ip)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Event.user.like(like))
            | (Event.source_ip.like(like))
            | (Event.device_id.like(like))
            | (Event.event_type.like(like))
        )

    sort_map = {
        "timestamp_desc": desc(Event.timestamp),
        "timestamp_asc": asc(Event.timestamp),
        "severity_desc": desc(Event.severity),
    }
    query = query.order_by(sort_map.get(sort, desc(Event.timestamp)))

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [e.to_dict() for e in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    return event.to_dict()


@router.get("/{event_id}/guidance")
def get_guidance(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    incident = event.incident
    correlated_events = []
    if incident:
        correlated_events = [e for e in incident.events if e.id != event.id]
    guidance = response_guidance.build_guidance(event, incident, correlated_events)
    return guidance


@router.get("/{event_id}/evidence")
def get_event_evidence(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    if not event.incident:
        return {"correlated": False, "evidence": []}
    return {"correlated": True, "incident_id": event.incident_id, "evidence": event.incident.correlation_evidence or []}


@router.post("", status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    try:
        normalized = normalization.normalize_event(payload.model_dump())
    except normalization.NormalizationError as e:
        raise HTTPException(422, str(e))

    event = Event(**normalized)
    db.add(event)
    db.flush()
    incident_builder.process_new_event(db, event)
    db.commit()
    db.refresh(event)
    return event.to_dict()


@router.patch("/{event_id}/status")
def update_event_status(event_id: str, payload: EventStatusUpdate, db: Session = Depends(get_db)):
    if payload.status not in ALERT_STATUSES:
        raise HTTPException(422, f"status must be one of {ALERT_STATUSES}")
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    event.status = payload.status
    db.commit()
    db.refresh(event)
    return event.to_dict()
