from sqlalchemy import Column, String, DateTime, JSON, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database.session import Base
from app.models.event import gen_id

INCIDENT_STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"]


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, default=lambda: gen_id("INC"))
    title = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="LOW")
    status = Column(String, nullable=False, default="OPEN")

    risk_score = Column(Integer, nullable=False, default=0)
    risk_factors = Column(JSON, nullable=True, default=list)  # list[{label, points, reason}]

    # Involved entities, stored as JSON lists for simplicity in a SQLite prototype.
    users = Column(JSON, nullable=True, default=list)
    source_ips = Column(JSON, nullable=True, default=list)
    devices = Column(JSON, nullable=True, default=list)

    correlation_evidence = Column(JSON, nullable=True, default=list)  # list[{reason, description}]

    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    events = relationship("Event", back_populates="incident", order_by="Event.timestamp")

    def to_dict(self, include_events=False):
        d = {
            "id": self.id,
            "title": self.title,
            "severity": self.severity,
            "status": self.status,
            "risk_score": self.risk_score,
            "risk_factors": self.risk_factors or [],
            "users": self.users or [],
            "source_ips": self.source_ips or [],
            "devices": self.devices or [],
            "correlation_evidence": self.correlation_evidence or [],
            "alert_count": len(self.events) if self.events is not None else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_events:
            d["events"] = [e.to_dict() for e in self.events]
        return d
