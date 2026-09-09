from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.database.session import get_db
from app.models.incident import Incident, INCIDENT_STATUSES

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("")
def list_incidents(
    db: Session = Depends(get_db),
    status: str | None = None,
    severity: str | None = None,
    search: str | None = None,
    sort: str = Query("updated_desc"),
):
    query = db.query(Incident).options(joinedload(Incident.events))
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if search:
        like = f"%{search}%"
        query = query.filter(Incident.title.like(like))

    sort_map = {
        "updated_desc": desc(Incident.updated_at),
        "risk_desc": desc(Incident.risk_score),
        "created_desc": desc(Incident.created_at),
    }
    query = query.order_by(sort_map.get(sort, desc(Incident.updated_at)))

    incidents = query.all()
    return [i.to_dict() for i in incidents]


@router.get("/{incident_id}")
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).options(joinedload(Incident.events)).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    return incident.to_dict(include_events=True)


@router.patch("/{incident_id}")
def update_incident(incident_id: str, payload: dict, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    status = payload.get("status")
    if status is not None:
        if status not in INCIDENT_STATUSES:
            raise HTTPException(422, f"status must be one of {INCIDENT_STATUSES}")
        incident.status = status
    db.commit()
    db.refresh(incident)
    return incident.to_dict(include_events=True)
