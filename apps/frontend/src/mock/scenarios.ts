import type {
  Decision,
  InputEvent,
  Recommendation,
  RiskState,
  SimulationResult,
  WorldState,
} from "@ai-env/contracts";

/**
 * Mock cognitive traces.
 *
 * Every object here conforms exactly to `@ai-env/contracts` — no invented
 * fields, no reshaped payloads. When the Backend is connected the mock engine
 * is swapped out and these same components render live data unchanged.
 *
 * Each scenario carries the *complete* trace (inputs -> world state -> risks ->
 * simulations -> decision -> recommendation), because the interface's whole
 * argument is that the reasoning is inspectable, not just the conclusion.
 */

export interface CognitiveTrace {
  key: string;
  label: string;
  inputEvents: InputEvent[];
  worldState: WorldState;
  risks: RiskState[];
  simulations: SimulationResult[];
  decision: Decision;
  recommendation: Recommendation;
}

const CAMPUS = { lat: 17.385, lng: 78.4867 };
const NORTH_GATE = { lat: 17.3891, lng: 78.4849 };
const SOUTH_GATE = { lat: 17.3812, lng: 78.4881 };
const AUDITORIUM = { lat: 17.3856, lng: 78.4894 };

const now = () => new Date().toISOString();
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/** Named places -> coordinates. The Backend sends `location` as either a
 *  GeoLocation or a human label; this gazetteer lets the map resolve both. */
export const GAZETTEER: Record<string, { lat: number; lng: number }> = {
  "South Gate": SOUTH_GATE,
  "North Gate": NORTH_GATE,
  Auditorium: AUDITORIUM,
  Campus: CAMPUS,
};

// ---------------------------------------------------------------------------
// Scenario 1 — the headline case: rain compounding congestion.
// ---------------------------------------------------------------------------

function stormTrace(): CognitiveTrace {
  const worldStateId = "ws-2f1a";
  const congestionRisk: RiskState = {
    id: "risk-congestion-01",
    riskType: "congestion",
    severity: "medium",
    status: "active",
    description: "Medium traffic congestion at South Gate.",
    location: SOUTH_GATE,
    affectedEntityIds: ["entity-traffic-south-gate"],
    worldStateId,
    detectedAt: now(),
    updatedAt: now(),
  };
  const delayRisk: RiskState = {
    id: "risk-travel-delay-01",
    riskType: "travel-delay",
    severity: "high",
    status: "active",
    description:
      "Heavy rain combined with congestion significantly increases travel delay risk near South Gate.",
    location: SOUTH_GATE,
    affectedEntityIds: ["entity-weather-south-gate", "entity-traffic-south-gate"],
    worldStateId,
    detectedAt: now(),
    updatedAt: now(),
  };

  const simulations: SimulationResult[] = [
    {
      id: "sim-north-gate",
      worldStateId,
      goalStateId: "goal-arrive-3pm",
      candidateAction: "Depart 20 minutes early and route via North Gate",
      predictedOutcome: "Arrives 6 minutes before the lecture despite rainfall.",
      affectedRiskIds: [congestionRisk.id, delayRisk.id],
      successProbability: 0.87,
      estimatedCost: "20 minutes earlier departure",
      generatedAt: now(),
    },
    {
      id: "sim-wait-out",
      worldStateId,
      goalStateId: "goal-arrive-3pm",
      candidateAction: "Wait for rainfall to subside, then depart normally",
      predictedOutcome: "Rain persists past the departure window; arrives 11 minutes late.",
      affectedRiskIds: [delayRisk.id],
      successProbability: 0.34,
      estimatedCost: "High risk of lateness",
      generatedAt: now(),
    },
    {
      id: "sim-status-quo",
      worldStateId,
      goalStateId: "goal-arrive-3pm",
      candidateAction: "Depart as normal via South Gate",
      predictedOutcome: "Encounters peak congestion at the gate; arrives 14 minutes late.",
      affectedRiskIds: [congestionRisk.id, delayRisk.id],
      successProbability: 0.21,
      estimatedCost: "Highest exposure",
      generatedAt: now(),
    },
  ];

  const decision: Decision = {
    id: "decision-8c4d",
    worldStateId,
    goalStateId: "goal-arrive-3pm",
    chosenSimulationResultId: "sim-north-gate",
    consideredSimulationResultIds: simulations.map((s) => s.id),
    consensusScore: 0.82,
    expertVotes: [
      {
        expertName: "Mobility Analyst",
        vote: "Endorse North Gate",
        rationale:
          "North Gate approach carries 40% of South Gate's volume and is unaffected by the flooded underpass.",
      },
      {
        expertName: "Weather Risk",
        vote: "Endorse, with earlier departure",
        rationale:
          "Rainfall intensity peaks in 25 minutes. Departing early clears the corridor before the peak.",
      },
      {
        expertName: "Schedule Guardian",
        vote: "Endorse",
        rationale: "A 20-minute buffer preserves on-time arrival at the 3 PM lecture.",
      },
      {
        expertName: "Safety Officer",
        vote: "Endorse with caution",
        rationale:
          "Reduced visibility in heavy rain. Recommendation should mention pedestrian caution near the North Gate crossing.",
      },
    ],
    governanceStatus: "approved",
    governanceNotes: "No policy constraints triggered. Advisory only — no automated action taken.",
    rationale:
      "Highest-severity active risk is 'travel-delay' (high). Rerouting via North Gate with an earlier departure dominates all considered alternatives on success probability.",
    decidedAt: now(),
  };

  return {
    key: "storm",
    label: "Rain + congestion",
    inputEvents: [
      {
        id: "in-weather-01",
        type: "input.weather.updated",
        timestamp: now(),
        source: "open-meteo",
        payload: {
          location: "South Gate",
          condition: "heavy_rain",
          temperatureC: 24.2,
          precipitationMm: 18.4,
          windKph: 22.6,
          humidityPercent: 91,
          forecast: [
            { time: minutesFromNow(30), temperatureC: 23.6, precipitationProbability: 88 },
            { time: minutesFromNow(60), temperatureC: 23.1, precipitationProbability: 74 },
          ],
        },
      },
      {
        id: "in-traffic-01",
        type: "input.traffic.updated",
        timestamp: now(),
        source: "tomtom",
        payload: {
          location: "South Gate",
          congestionLevel: "medium",
          averageSpeedKph: 14,
          travelTimeMinutes: 12.5,
          delaySeconds: 260,
          routeStatus: "open",
        },
      },
      {
        id: "in-announcement-01",
        type: "input.announcement.created",
        timestamp: now(),
        source: "campus-admin",
        payload: {
          title: "Guest Lecture — Auditorium, 3 PM",
          body: "Expect increased foot traffic near the Auditorium from 2:30 PM.",
          category: "event",
        },
      },
    ],
    worldState: {
      id: worldStateId,
      scope: "niat-kkh-campus",
      version: 214,
      generatedAt: now(),
      summary:
        "Heavy rain at South Gate with medium congestion building; guest lecture drawing foot traffic to the Auditorium.",
      entities: [
        {
          id: "entity-weather-south-gate",
          type: "weather",
          label: "South Gate",
          location: SOUTH_GATE,
          attributes: { condition: "heavy_rain", precipitationMm: 18.4, humidityPercent: 91 },
          updatedAt: now(),
        },
        {
          id: "entity-traffic-south-gate",
          type: "traffic-segment",
          label: "South Gate approach",
          location: SOUTH_GATE,
          attributes: { congestionLevel: "medium", averageSpeedKph: 14, delaySeconds: 260 },
          updatedAt: now(),
        },
        {
          id: "entity-traffic-north-gate",
          type: "traffic-segment",
          label: "North Gate approach",
          location: NORTH_GATE,
          attributes: { congestionLevel: "low", averageSpeedKph: 34 },
          updatedAt: now(),
        },
        {
          id: "entity-event-auditorium",
          type: "campus-event",
          label: "Guest Lecture",
          location: AUDITORIUM,
          attributes: { startsAt: "15:00", expectedAttendance: 260 },
          updatedAt: now(),
        },
      ],
      sourceEventIds: ["in-weather-01", "in-traffic-01", "in-announcement-01"],
    },
    risks: [delayRisk, congestionRisk],
    simulations,
    decision,
    recommendation: {
      id: "rec-9a17",
      decisionId: decision.id,
      title: "Leave earlier and enter via North Gate",
      action: "Leave 20 minutes earlier and enter campus via the North Gate.",
      reasoning:
        "Rainfall at South Gate is intensifying and will peak in roughly 25 minutes, compounding congestion that is already reducing approach speeds to 14 km/h. North Gate is carrying substantially lighter traffic and is unaffected. Departing early clears the corridor ahead of the rainfall peak.",
      evidence: [
        {
          type: "world_state",
          refId: worldStateId,
          description: "Heavy rain at South Gate; medium congestion building.",
        },
        {
          type: "risk_state",
          refId: delayRisk.id,
          description: "High travel-delay risk from rain and congestion combined.",
        },
        {
          type: "risk_state",
          refId: congestionRisk.id,
          description: "Medium congestion at South Gate approach.",
        },
        {
          type: "input_event",
          refId: "in-weather-01",
          description: "18.4mm precipitation, 88% chance of continued rain within 30 min.",
        },
      ],
      confidence: 0.87,
      alternatives: [
        {
          option: "Wait for rain to subside",
          reason: "Rain persists past the departure window — 34% success, arrives late.",
        },
        {
          option: "Depart as normal via South Gate",
          reason: "Highest exposure to both risks — 21% success, arrives 14 minutes late.",
        },
      ],
      relatedRiskIds: [delayRisk.id, congestionRisk.id],
      worldStateId,
      targetUserIds: ["student-3pm-cohort"],
      status: "proposed",
      createdAt: now(),
      validUntil: minutesFromNow(45),
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario 2 — calm. Proves the system says "no action needed" convincingly,
// and that low-risk states look genuinely different rather than just emptier.
// ---------------------------------------------------------------------------

function calmTrace(): CognitiveTrace {
  const worldStateId = "ws-3b7c";
  const simulations: SimulationResult[] = [
    {
      id: "sim-no-action",
      worldStateId,
      candidateAction: "Maintain current routing; continue monitoring",
      predictedOutcome: "Conditions remain within normal parameters for the next hour.",
      affectedRiskIds: [],
      successProbability: 0.94,
      generatedAt: now(),
    },
  ];

  const decision: Decision = {
    id: "decision-1f0a",
    worldStateId,
    chosenSimulationResultId: "sim-no-action",
    consideredSimulationResultIds: ["sim-no-action"],
    consensusScore: 0.94,
    expertVotes: [
      {
        expertName: "Mobility Analyst",
        vote: "No action",
        rationale: "All approaches operating at or near free-flow speed.",
      },
      {
        expertName: "Weather Risk",
        vote: "No action",
        rationale: "Clear conditions; no precipitation forecast within the monitoring window.",
      },
    ],
    governanceStatus: "approved",
    governanceNotes: "No policy constraints triggered.",
    rationale: "No active risks detected in the current WorldState.",
    decidedAt: now(),
  };

  return {
    key: "calm",
    label: "Clear conditions",
    inputEvents: [
      {
        id: "in-weather-02",
        type: "input.weather.updated",
        timestamp: now(),
        source: "open-meteo",
        payload: {
          location: "South Gate",
          condition: "clear",
          temperatureC: 27.8,
          precipitationMm: 0,
          windKph: 8.1,
          humidityPercent: 46,
        },
      },
      {
        id: "in-traffic-02",
        type: "input.traffic.updated",
        timestamp: now(),
        source: "tomtom",
        payload: {
          location: "South Gate",
          congestionLevel: "low",
          averageSpeedKph: 38,
          travelTimeMinutes: 5.2,
          delaySeconds: 15,
          routeStatus: "open",
        },
      },
    ],
    worldState: {
      id: worldStateId,
      scope: "niat-kkh-campus",
      version: 215,
      generatedAt: now(),
      summary: "Clear conditions across campus. All approaches near free-flow speed.",
      entities: [
        {
          id: "entity-weather-south-gate",
          type: "weather",
          label: "South Gate",
          location: SOUTH_GATE,
          attributes: { condition: "clear", temperatureC: 27.8, humidityPercent: 46 },
          updatedAt: now(),
        },
        {
          id: "entity-traffic-south-gate",
          type: "traffic-segment",
          label: "South Gate approach",
          location: SOUTH_GATE,
          attributes: { congestionLevel: "low", averageSpeedKph: 38 },
          updatedAt: now(),
        },
      ],
      sourceEventIds: ["in-weather-02", "in-traffic-02"],
    },
    risks: [],
    simulations,
    decision,
    recommendation: {
      id: "rec-2c30",
      decisionId: decision.id,
      title: "No action needed",
      action: "Continue as planned. No route or timing change required.",
      reasoning:
        "No active risks were detected. All campus approaches are operating at or near free-flow speed, and no precipitation is forecast within the monitoring window.",
      evidence: [
        {
          type: "world_state",
          refId: worldStateId,
          description: "Clear conditions; all approaches near free-flow.",
        },
        {
          type: "input_event",
          refId: "in-traffic-02",
          description: "South Gate approach at 38 km/h, 15s delay.",
        },
      ],
      confidence: 0.94,
      alternatives: [
        {
          option: "Pre-emptively reroute via North Gate",
          reason: "No benefit — South Gate is already at free-flow speed.",
        },
      ],
      relatedRiskIds: [],
      worldStateId,
      status: "proposed",
      createdAt: now(),
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario 3 — low confidence with conflicting experts. This is the state most
// AI demos hide; showing it honestly is what makes the confident states
// believable.
// ---------------------------------------------------------------------------

function contestedTrace(): CognitiveTrace {
  const worldStateId = "ws-5d92";
  const closureRisk: RiskState = {
    id: "risk-closure-01",
    riskType: "route-closure",
    severity: "critical",
    status: "active",
    description: "North Gate approach reported closed; verification pending from a second source.",
    location: NORTH_GATE,
    affectedEntityIds: ["entity-traffic-north-gate"],
    worldStateId,
    detectedAt: now(),
    updatedAt: now(),
  };
  const crowdRisk: RiskState = {
    id: "risk-crowd-01",
    riskType: "crowd-density",
    severity: "high",
    status: "monitoring",
    description: "Auditorium egress converging with peak gate traffic.",
    location: AUDITORIUM,
    affectedEntityIds: ["entity-event-auditorium"],
    worldStateId,
    detectedAt: now(),
    updatedAt: now(),
  };

  const simulations: SimulationResult[] = [
    {
      id: "sim-hold",
      worldStateId,
      candidateAction: "Hold departure 15 minutes and re-evaluate after closure is confirmed",
      predictedOutcome: "Avoids committing to a route while the closure report is unverified.",
      affectedRiskIds: [closureRisk.id],
      successProbability: 0.58,
      estimatedCost: "15 minutes of delay, possibly unnecessary",
      generatedAt: now(),
    },
    {
      id: "sim-south-divert",
      worldStateId,
      candidateAction: "Divert all traffic to South Gate immediately",
      predictedOutcome: "Relieves North Gate but risks overloading South Gate during egress.",
      affectedRiskIds: [closureRisk.id, crowdRisk.id],
      successProbability: 0.51,
      estimatedCost: "Congestion transfer risk",
      generatedAt: now(),
    },
  ];

  const decision: Decision = {
    id: "decision-7e2b",
    worldStateId,
    chosenSimulationResultId: "sim-hold",
    consideredSimulationResultIds: simulations.map((s) => s.id),
    consensusScore: 0.44,
    expertVotes: [
      {
        expertName: "Mobility Analyst",
        vote: "Divert to South Gate",
        rationale: "Waiting wastes the pre-egress window when South Gate still has capacity.",
      },
      {
        expertName: "Safety Officer",
        vote: "Hold and verify",
        rationale:
          "Committing on a single unverified closure report risks routing people into a hazard.",
      },
      {
        expertName: "Crowd Dynamics",
        vote: "Hold and verify",
        rationale: "South Gate cannot absorb diverted volume during Auditorium egress.",
      },
      {
        expertName: "Schedule Guardian",
        vote: "Dissent",
        rationale: "A 15-minute hold causes missed connections for the 4 PM cohort.",
      },
    ],
    governanceStatus: "pending_human_approval",
    governanceNotes:
      "Consensus below the 0.60 threshold and a critical risk is unverified — escalated for human review before any broadcast.",
    rationale:
      "Expert council did not converge. Holding preserves optionality until the closure report is confirmed by a second source.",
    decidedAt: now(),
  };

  return {
    key: "contested",
    label: "Contested — low consensus",
    inputEvents: [
      {
        id: "in-traffic-03",
        type: "input.traffic.updated",
        timestamp: now(),
        source: "tomtom",
        payload: {
          location: "North Gate",
          congestionLevel: "high",
          averageSpeedKph: 4,
          travelTimeMinutes: 26,
          delaySeconds: 1180,
          routeStatus: "closed",
        },
      },
      {
        id: "in-announcement-03",
        type: "input.announcement.created",
        timestamp: now(),
        source: "campus-admin",
        payload: {
          title: "Auditorium session ending early",
          body: "The 2 PM session will release at 3:40 PM, ahead of schedule.",
          category: "event",
        },
      },
    ],
    worldState: {
      id: worldStateId,
      scope: "niat-kkh-campus",
      version: 216,
      generatedAt: now(),
      summary:
        "North Gate reported closed by a single source; Auditorium releasing early into peak gate traffic.",
      entities: [
        {
          id: "entity-traffic-north-gate",
          type: "traffic-segment",
          label: "North Gate approach",
          location: NORTH_GATE,
          attributes: { congestionLevel: "high", routeStatus: "closed", averageSpeedKph: 4 },
          updatedAt: now(),
        },
        {
          id: "entity-event-auditorium",
          type: "campus-event",
          label: "Auditorium egress",
          location: AUDITORIUM,
          attributes: { releasesAt: "15:40", expectedAttendance: 480 },
          updatedAt: now(),
        },
      ],
      sourceEventIds: ["in-traffic-03", "in-announcement-03"],
    },
    risks: [closureRisk, crowdRisk],
    simulations,
    decision,
    recommendation: {
      id: "rec-4b81",
      decisionId: decision.id,
      title: "Hold and verify before rerouting",
      action: "Hold departure 15 minutes while the North Gate closure is verified.",
      reasoning:
        "The closure is reported by a single source and has not been independently confirmed. The expert council did not converge: mobility favours an immediate diversion, while safety and crowd dynamics both warn that South Gate cannot absorb the volume during Auditorium egress. Holding preserves optionality at the cost of 15 minutes.",
      evidence: [
        {
          type: "risk_state",
          refId: closureRisk.id,
          description: "Critical: North Gate closure unverified.",
        },
        {
          type: "risk_state",
          refId: crowdRisk.id,
          description: "High: Auditorium egress converging with gate traffic.",
        },
        {
          type: "note",
          description: "Consensus 0.44 — below the 0.60 threshold for autonomous broadcast.",
        },
      ],
      confidence: 0.44,
      alternatives: [
        {
          option: "Divert to South Gate immediately",
          reason: "51% success — relieves North Gate but risks overloading South Gate.",
        },
      ],
      relatedRiskIds: [closureRisk.id, crowdRisk.id],
      worldStateId,
      status: "proposed",
      createdAt: now(),
      validUntil: minutesFromNow(15),
    },
  };
}

/** Regenerated per cycle so timestamps stay current. */
export function buildTraces(): CognitiveTrace[] {
  return [stormTrace(), calmTrace(), contestedTrace()];
}
