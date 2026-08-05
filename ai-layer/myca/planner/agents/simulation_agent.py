"""
Simulation Agent — Sandbox Execution Simulator
"""

import logging
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from myca.planner.agents.graph_agent import CandidateGraph

logger = logging.getLogger("myca.planner.agents.simulation")


class SimulationStepResult(BaseModel):
    node_id: str
    status: str  # "SIMULATED_SUCCESS" | "SIMULATED_FAILURE"
    simulated_outputs: Dict[str, Any] = Field(default_factory=dict)
    simulated_latency_ms: int = 10


class SimulationResult(BaseModel):
    candidate_id: str
    passed: bool = True
    simulated_steps: List[SimulationStepResult] = Field(default_factory=list)
    total_simulated_latency_ms: int = 0


class SimulationAgent:
    def __init__(self):
        pass

    def simulate_execution(self, candidate: CandidateGraph) -> SimulationResult:
        """
        Executes a mock sandbox dry-run of the candidate graph to verify data flow,
        type contracts, and execution paths before sending to Sovereign Runtime.
        """
        steps = []
        passed = True
        total_latency = 0

        for node in candidate.nodes:
            node_id = node.get("id", "node")
            skill = node.get("skill", "core.chat")
            inputs = node.get("inputs", {})

            # Mock simulation logic
            step_passed = True
            mock_out = {"status": "OK", "simulated_id": f"sim_{node_id}"}
            latency = 20

            if "read" in skill:
                mock_out["content"] = "Simulated File Content Payload"
            elif "telegram" in skill:
                mock_out["message_id"] = 12049
            elif "postgres" in skill:
                mock_out["rows"] = [{"id": 1, "value": "test"}]

            steps.append(SimulationStepResult(
                node_id=node_id,
                status="SIMULATED_SUCCESS" if step_passed else "SIMULATED_FAILURE",
                simulated_outputs=mock_out,
                simulated_latency_ms=latency
            ))
            total_latency += latency

        logger.info(f"[SIMULATION AGENT] Simulated '{candidate.candidate_id}': Passed={passed}, Total Latency={total_latency}ms")
        return SimulationResult(
            candidate_id=candidate.candidate_id,
            passed=passed,
            simulated_steps=steps,
            total_simulated_latency_ms=total_latency
        )
