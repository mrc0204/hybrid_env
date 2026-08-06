"""GET /trace/latest — the full cognitive trace behind the most recent
/reason call. Additive read path for the Frontend's Reasoning Spine; see
trace_service.py for why this exists as a separate endpoint rather than
changing /reason's own response.
"""

from fastapi import APIRouter, HTTPException

from app.contracts.api import ApiSuccess, ReasonTrace
from app.dependencies import TraceServiceDep

router = APIRouter()


@router.get("/trace/latest", response_model=ApiSuccess[ReasonTrace])
def latest_trace(trace_service: TraceServiceDep) -> ApiSuccess[ReasonTrace]:
    trace = trace_service.get()
    if trace is None:
        raise HTTPException(status_code=404, detail="No reasoning cycle has run yet")
    return ApiSuccess(data=trace)
