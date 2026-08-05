"""
Cost & Compute Dispatch Agent

Selects compute targets (Local Model, Colony GPU Mesh, 0G Compute)
based on latency, privacy policy, hardware capabilities, and cost constraints.
"""

import logging
from typing import Dict, Any
from pydantic import BaseModel

logger = logging.getLogger("myca.planner.agents.cost")


class ComputeDispatchDecision(BaseModel):
    target: str  # "local" | "colony_mesh" | "0g_compute"
    model: str
    estimated_cost_usd: float
    estimated_latency_ms: int
    reasoning: str


class CostAgent:
    def __init__(self):
        pass

    def evaluate_dispatch(self, capability_type: str, context: Dict[str, Any]) -> ComputeDispatchDecision:
        """Evaluates optimal compute target for an abstract compute job."""
        privacy_policy = context.get("privacy_policy", "strict")

        if privacy_policy == "strict" or "local" in capability_type.lower():
            logger.info("[COST AGENT] Dispatched to Local MLX/Metal engine (Strict Privacy).")
            return ComputeDispatchDecision(
                target="local",
                model="llama-3.2-3b-mlx",
                estimated_cost_usd=0.0,
                estimated_latency_ms=150,
                reasoning="Strict privacy policy enforces local on-device GPU inference."
            )

        if "0g" in str(context).lower():
            logger.info("[COST AGENT] Dispatched to 0G Decentralized Compute Mesh.")
            return ComputeDispatchDecision(
                target="0g_compute",
                model="deepseek-r1-0g",
                estimated_cost_usd=0.002,
                estimated_latency_ms=800,
                reasoning="Heavy reasoning intent routed to 0G Verifiable Compute Cluster."
            )

        return ComputeDispatchDecision(
            target="colony_mesh",
            model="qwen-2.5-coder-7b",
            estimated_cost_usd=0.0005,
            estimated_latency_ms=300,
            reasoning="Balanced workload dispatched to Colony P2P GPU Mesh."
        )
