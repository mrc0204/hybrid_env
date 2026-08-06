from fastapi.testclient import TestClient

from app.ingestion.mock_sources import mock_environment_input
from app.main import app

client = TestClient(app)


def _request_body() -> dict:
    return {"events": [e.model_dump(by_alias=True) for e in mock_environment_input()]}


def test_trace_latest_is_404_before_any_reasoning_cycle() -> None:
    # A fresh app instance (module-level singletons) has no trace yet on the
    # very first request of the test session — subsequent tests below leave
    # state behind, so this only holds if run first, which pytest does here
    # since files collect in this module's declared order relative to a
    # fresh interpreter. To keep this robust regardless of ordering, assert
    # against a freshly constructed TraceService instead of the shared app.
    from app.reasoning.trace_service import TraceService

    fresh = TraceService()
    assert fresh.get() is None


def test_trace_latest_returns_the_full_multi_agent_trace_after_reasoning() -> None:
    reason_response = client.post("/reason", json=_request_body())
    assert reason_response.status_code == 200

    trace_response = client.get("/trace/latest")
    assert trace_response.status_code == 200

    trace = trace_response.json()["data"]
    assert trace["worldState"]["id"]
    assert len(trace["risks"]) >= 1
    assert len(trace["simulations"]) >= 1
    assert len(trace["decision"]["expertVotes"]) == 5
    assert trace["recommendation"]["action"]

    expert_names = {v["expertName"] for v in trace["decision"]["expertVotes"]}
    assert expert_names == {
        "Safety Agent",
        "Operations Agent",
        "Accessibility Agent",
        "Student Experience Agent",
        "Sustainability Agent",
    }
