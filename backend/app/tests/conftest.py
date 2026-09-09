import os
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.database.init_db import DEFAULT_RULES
from app.models.rule import Rule


@pytest.fixture()
def db_session():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    for r in DEFAULT_RULES:
        session.add(Rule(**r))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        os.remove(path)


@pytest.fixture()
def client(db_session, monkeypatch):
    """FastAPI TestClient wired to the isolated test DB session."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database.session import get_db
    import app.main as main_module

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Avoid touching the real dev/demo database during the startup event.
    monkeypatch.setattr(main_module, "init_db", lambda: None)
    monkeypatch.setattr(main_module, "seed_run", lambda: None)

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
