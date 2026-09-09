from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.init_db import init_db
from app.database.seed import run as seed_run
from app.api import events, incidents, rules, stats, simulator

app = FastAPI(
    title="Alertious API",
    description="Security alert correlation and incident investigation prototype. "
                 "All data is synthetic. Not intended for production security use.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    seed_run()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "alertious-api", "simulated_environment": True}


# simulator.router defines /api/events/stream, which must be registered
# BEFORE events.router's /api/events/{event_id} wildcard route, or the
# wildcard will greedily match "stream" as an event_id.
app.include_router(simulator.router)
app.include_router(events.router)
app.include_router(incidents.router)
app.include_router(rules.router)
app.include_router(stats.router)
