import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.session import get_db, SessionLocal
from app.models.event import Event
from app.services.simulator import SCENARIOS, run_scenario

router = APIRouter(prefix="/api", tags=["simulator"])


@router.get("/simulator/scenarios")
def list_scenarios():
    return [{"id": k, "name": v} for k, v in SCENARIOS.items()]


@router.post("/simulator/start")
def start_simulator(payload: dict, db: Session = Depends(get_db)):
    scenario = payload.get("scenario")
    if scenario not in SCENARIOS:
        raise HTTPException(422, f"scenario must be one of {list(SCENARIOS.keys())}")
    created = run_scenario(db, scenario)
    return {"scenario": scenario, "events_created": len(created), "events": created}


@router.post("/simulator/stop")
def stop_simulator():
    # The simulator here runs synchronously to completion per scenario run
    # (each call to /simulator/start fully executes one scenario through the
    # real pipeline). There is no long-running background job to cancel, but
    # the endpoint is kept for API symmetry / future async scenario support.
    return {"status": "idle"}


@router.get("/events/stream")
async def stream_events():
    """Server-Sent Events endpoint. Polls the DB for newly created events
    and incident updates, pushing them to connected clients.
    """

    async def event_generator():
        db = SessionLocal()
        try:
            last_seen = db.query(Event).order_by(desc(Event.created_at)).first()
            last_created_at = last_seen.created_at if last_seen else None
            while True:
                db.expire_all()
                query = db.query(Event).order_by(Event.created_at.asc())
                if last_created_at is not None:
                    query = query.filter(Event.created_at > last_created_at)
                new_events = query.all()
                for e in new_events:
                    last_created_at = e.created_at
                    data = e.to_dict()
                    yield f"event: event_created\ndata: {json.dumps(data)}\n\n"
                yield ": keep-alive\n\n"
                await asyncio.sleep(2)
        finally:
            db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
