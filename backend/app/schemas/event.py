from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class EventCreate(BaseModel):
    timestamp: Optional[datetime] = None
    event_type: str
    severity: Optional[str] = None
    user: Optional[str] = None
    source_ip: Optional[str] = None
    device_id: Optional[str] = None
    source: Optional[str] = "manual"
    destination: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: str
    timestamp: Optional[str]
    event_type: str
    severity: str
    user: Optional[str]
    source_ip: Optional[str]
    device_id: Optional[str]
    source: Optional[str]
    destination: Optional[str]
    metadata: Dict[str, Any]
    status: str
    incident_id: Optional[str]


class EventStatusUpdate(BaseModel):
    status: str


class PaginatedEvents(BaseModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class ResponseGuidance(BaseModel):
    alert_id: str
    what_happened: str
    why_it_matters: str
    review_steps: list[str]
    possible_resolution: list[str]
    severity: str
