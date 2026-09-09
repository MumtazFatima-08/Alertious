def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["simulated_environment"] is True


def test_create_event_and_fetch(client):
    r = client.post("/api/events", json={"event_type": "LOGIN_FAILED", "user": "alex", "source_ip": "1.1.1.1", "device_id": "D1"})
    assert r.status_code == 201
    event = r.json()
    r2 = client.get(f"/api/events/{event['id']}")
    assert r2.status_code == 200
    assert r2.json()["id"] == event["id"]


def test_create_event_invalid_type_returns_422(client):
    r = client.post("/api/events", json={"event_type": "NOT_REAL"})
    assert r.status_code == 422


def test_event_status_update_persists(client):
    r = client.post("/api/events", json={"event_type": "LOGIN_FAILED", "user": "bob"})
    event_id = r.json()["id"]
    r2 = client.patch(f"/api/events/{event_id}/status", json={"status": "INVESTIGATING"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "INVESTIGATING"
    r3 = client.get(f"/api/events/{event_id}")
    assert r3.json()["status"] == "INVESTIGATING"


def test_event_pagination(client):
    for i in range(30):
        client.post("/api/events", json={"event_type": "LOGOUT", "user": f"user{i}"})
    r = client.get("/api/events?page=1&page_size=10")
    data = r.json()
    assert data["page_size"] == 10
    assert len(data["items"]) == 10
    assert data["total"] >= 30
    assert data["total_pages"] >= 3


def test_correlation_creates_incident_via_api(client):
    client.post("/api/events", json={"event_type": "LOGIN_FAILED", "user": "alex", "source_ip": "5.5.5.5", "device_id": "D5"})
    r = client.post("/api/events", json={"event_type": "LOGIN_SUCCESS", "user": "alex", "source_ip": "5.5.5.5", "device_id": "D5"})
    event = r.json()
    assert event["incident_id"] is not None

    r2 = client.get(f"/api/incidents/{event['incident_id']}")
    assert r2.status_code == 200
    incident = r2.json()
    assert incident["alert_count"] == 2
    assert incident["risk_score"] > 0
    assert len(incident["correlation_evidence"]) > 0


def test_incident_status_update(client):
    client.post("/api/events", json={"event_type": "LOGIN_FAILED", "user": "carol", "source_ip": "8.8.8.8", "device_id": "D8"})
    r = client.post("/api/events", json={"event_type": "LOGIN_SUCCESS", "user": "carol", "source_ip": "8.8.8.8", "device_id": "D8"})
    incident_id = r.json()["incident_id"]
    r2 = client.patch(f"/api/incidents/{incident_id}", json={"status": "RESOLVED"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "RESOLVED"


def test_rules_list_and_toggle(client):
    r = client.get("/api/rules")
    rules = r.json()
    assert len(rules) > 0
    rule_id = rules[0]["id"]
    r2 = client.patch(f"/api/rules/{rule_id}", json={"enabled": False})
    assert r2.status_code == 200
    assert r2.json()["enabled"] is False


def test_disabling_rule_changes_correlation_behavior(client):
    # Disable every rule.
    rules = client.get("/api/rules").json()
    for r in rules:
        client.patch(f"/api/rules/{r['id']}", json={"enabled": False})

    client.post("/api/events", json={"event_type": "LOGIN_FAILED", "user": "dana", "source_ip": "3.3.3.3", "device_id": "D3"})
    r = client.post("/api/events", json={"event_type": "LOGIN_SUCCESS", "user": "dana", "source_ip": "3.3.3.3", "device_id": "D3"})
    assert r.json()["incident_id"] is None

    # Re-enable and confirm correlation resumes.
    for r2 in rules:
        client.patch(f"/api/rules/{r2['id']}", json={"enabled": True})
    client.post("/api/events", json={"event_type": "LOGIN_FAILED", "user": "erin", "source_ip": "4.4.4.4", "device_id": "D4"})
    r3 = client.post("/api/events", json={"event_type": "LOGIN_SUCCESS", "user": "erin", "source_ip": "4.4.4.4", "device_id": "D4"})
    assert r3.json()["incident_id"] is not None


def test_stats_reflect_real_data(client):
    r0 = client.get("/api/stats").json()
    client.post("/api/events", json={"event_type": "LOGOUT", "user": "frank"})
    r1 = client.get("/api/stats").json()
    assert r1["events_processed"] == r0["events_processed"] + 1


def test_simulator_runs_through_real_pipeline(client):
    r = client.post("/api/simulator/start", json={"scenario": "account_takeover"})
    assert r.status_code == 200
    data = r.json()
    assert data["events_created"] > 0
    # At least one of the generated events should have formed/joined an incident.
    assert any(e["incident_id"] is not None for e in data["events"])


def test_simulator_invalid_scenario_rejected(client):
    r = client.post("/api/simulator/start", json={"scenario": "not_a_scenario"})
    assert r.status_code == 422


def test_guidance_endpoint_returns_contextual_fields(client):
    r = client.post("/api/events", json={"event_type": "PRIVILEGE_CHANGE", "user": "gina", "severity": "HIGH"})
    event_id = r.json()["id"]
    r2 = client.get(f"/api/events/{event_id}/guidance")
    body = r2.json()
    assert body["alert_id"] == event_id
    assert "why_it_matters" in body
    assert len(body["review_steps"]) > 0


def test_events_stream_route_not_shadowed_by_event_id_route(client):
    """Regression test: /api/events/stream must not be captured by the
    /api/events/{event_id} wildcard route. If router registration order is
    wrong, this resolves to the event-detail handler instead of the SSE
    stream handler.
    """
    from app.main import app

    matched_names = []
    for route in app.router.routes:
        if getattr(route, "path", None) == "/api/events/stream":
            matched_names.append(route.name)
    assert "stream_events" in matched_names

    # Confirm the wildcard route is registered AFTER the stream route, so
    # Starlette resolves /api/events/stream to stream_events, not get_event.
    stream_index = next(i for i, r in enumerate(app.router.routes) if getattr(r, "path", None) == "/api/events/stream")
    wildcard_index = next(i for i, r in enumerate(app.router.routes) if getattr(r, "path", None) == "/api/events/{event_id}")
    assert stream_index < wildcard_index
