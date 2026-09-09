from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Integer
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone

from app.database.session import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


EVENT_TYPES = [
    "LOGIN_FAILED",
    "LOGIN_SUCCESS",
    "NEW_DEVICE",
    "PRIVILEGE_CHANGE",
    "FILE_ACCESS",
    "NETWORK_CONNECTION",
    "PROCESS_EXECUTION",
    "DATA_TRANSFER",
    "LOGOUT",
]

SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

ALERT_STATUSES = ["NEW", "INVESTIGATING", "EXPECTED", "RESOLVED"]


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: gen_id("EVT"))
    timestamp = Column(DateTime, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, index=True)
    user = Column(String, nullable=True, index=True)
    source_ip = Column(String, nullable=True, index=True)
    device_id = Column(String, nullable=True, index=True)
    source = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    event_metadata = Column(JSON, nullable=True, default=dict)

    status = Column(String, nullable=False, default="NEW")

    incident_id = Column(String, ForeignKey("incidents.id"), nullable=True, index=True)
    incident = relationship("Incident", back_populates="events")

    created_at = Column(DateTime, default=lambda: datetime.utcnow())

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "event_type": self.event_type,
            "severity": self.severity,
            "user": self.user,
            "source_ip": self.source_ip,
            "device_id": self.device_id,
            "source": self.source,
            "destination": self.destination,
            "metadata": self.event_metadata or {},
            "status": self.status,
            "incident_id": self.incident_id,
        }
