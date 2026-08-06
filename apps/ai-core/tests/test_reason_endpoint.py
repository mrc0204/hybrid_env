from fastapi.testclient import TestClient

from app.ingestion.mock_sources import mock_environment_input
from app.main import app

client = TestClient(app)


def _request_body() -> dict:
    return {"events": [e.model_dump(by_alias=True) for e in mock_environment_input()]}


def test_reason_endpoint_returns_a_full_recommendation() -> None:
    response = client.post("/reason", json=_request_body())

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True

    recommendation = body["data"]
    assert recommendation["action"]
    assert recommendation["reasoning"]
    assert recommendation["evidence"]
    assert 0.0 < recommendation["confidence"] <= 1.0
    assert recommendation["alternatives"]
    assert recommendation["decisionId"]


def test_reason_with_no_events_still_returns_a_recommendation() -> None:
    response = client.post("/reason", json={"events": []})

    assert response.status_code == 200
    recommendation = response.json()["data"]
    assert recommendation["title"] == "No action needed"
    assert recommendation["evidence"]


def test_reason_rejects_an_unknown_event_type() -> None:
    response = client.post("/reason", json={"events": [{"type": "input.bogus", "id": "x"}]})

    assert response.status_code == 422


def test_health_endpoint_still_works() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"
