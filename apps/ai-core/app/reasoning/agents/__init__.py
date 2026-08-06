from app.reasoning.agents.accessibility_agent import AccessibilityAgent
from app.reasoning.agents.base import AgentOpinion, ExpertAgent
from app.reasoning.agents.operations_agent import OperationsAgent
from app.reasoning.agents.safety_agent import SafetyAgent
from app.reasoning.agents.student_experience_agent import StudentExperienceAgent
from app.reasoning.agents.sustainability_agent import SustainabilityAgent

__all__ = [
    "AgentOpinion",
    "ExpertAgent",
    "SafetyAgent",
    "OperationsAgent",
    "AccessibilityAgent",
    "StudentExperienceAgent",
    "SustainabilityAgent",
]


def default_agents() -> list[ExpertAgent]:
    return [
        SafetyAgent(),
        OperationsAgent(),
        AccessibilityAgent(),
        StudentExperienceAgent(),
        SustainabilityAgent(),
    ]
