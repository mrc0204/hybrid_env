from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_reason_endpoint_returns_a_full_recommendation() -> None:
    response = client.post("/reason")

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


def test_health_endpoint_still_works() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"
