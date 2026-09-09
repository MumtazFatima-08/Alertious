"""Event normalization.

Raw incoming event payloads (from the API or the simulator) are converted
into a consistent internal representation before they are persisted and
handed to the correlation engine. This keeps the correlation engine free
of "is this field missing / is this casing consistent" concerns.
"""
from datetime import datetime, timezone
from typing import Optional

from app.models.event import EVENT_TYPES, SEVERITIES

# Default severities per event type when the caller doesn't specify one.
# These are intentionally conservative defaults - a single LOGIN_FAILED is
# low severity; it only becomes interesting through correlation.
DEFAULT_SEVERITY = {
    "LOGIN_FAILED": "LOW",
    "LOGIN_SUCCESS": "LOW",
    "NEW_DEVICE": "MEDIUM",
    "PRIVILEGE_CHANGE": "HIGH",
    "FILE_ACCESS": "MEDIUM",
    "NETWORK_CONNECTION": "LOW",
    "PROCESS_EXECUTION": "MEDIUM",
    "DATA_TRANSFER": "HIGH",
    "LOGOUT": "LOW",
}


class NormalizationError(ValueError):
    pass


def normalize_event(payload: dict) -> dict:
    """Validate and normalize a raw event payload into a canonical dict
    ready to be written to the `events` table.
    """
    event_type = (payload.get("event_type") or "").strip().upper()
    if event_type not in EVENT_TYPES:
        raise NormalizationError(f"Unknown event_type '{event_type}'. Must be one of {EVENT_TYPES}")

    severity = (payload.get("severity") or "").strip().upper() or DEFAULT_SEVERITY.get(event_type, "LOW")
    if severity not in SEVERITIES:
        raise NormalizationError(f"Unknown severity '{severity}'. Must be one of {SEVERITIES}")

    ts = payload.get("timestamp")
    if ts is None:
        ts = datetime.now(timezone.utc)
    elif isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    # SQLite has no native timezone-aware storage; normalize everything to a
    # naive UTC datetime so comparisons between freshly-created and
    # DB-loaded events are always consistent.
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc).replace(tzinfo=None)

    user = _clean_str(payload.get("user"))
    source_ip = _clean_str(payload.get("source_ip"))
    device_id = _clean_str(payload.get("device_id"))

    return {
        "timestamp": ts,
        "event_type": event_type,
        "severity": severity,
        "user": user,
        "source_ip": source_ip,
        "device_id": device_id,
        "source": _clean_str(payload.get("source")) or "unknown",
        "destination": _clean_str(payload.get("destination")),
        "event_metadata": payload.get("metadata") or {},
    }


def _clean_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value or None
