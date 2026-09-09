from pydantic import BaseModel
from typing import Optional, Any


class IncidentOut(BaseModel):
    id: str
    title: str
    severity: str
    status: str
    risk_score: int
    risk_factors: list[dict]
    users: list[str]
    source_ips: list[str]
    devices: list[str]
    correlation_evidence: list[dict]
    alert_count: int
    created_at: Optional[str]
    updated_at: Optional[str]
    events: Optional[list[dict]] = None


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
