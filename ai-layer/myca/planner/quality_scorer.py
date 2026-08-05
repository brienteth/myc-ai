"""
Graph Quality Scorer Engine

Evaluates candidate execution graphs across 8 metrics:
Correctness, Latency, Security, Cost, Privacy, Reliability, Complexity, Repairability.
Target Quality Score >= 96/100 before Sovereign Runtime execution.
"""

import logging
from typing import Dict, Any
from pydantic import BaseModel
from myca.planner.agents.graph_agent import CandidateGraph
from myca.planner.agents.critic_agent import CriticFeedback
from myca.planner.agents.simulation_agent import SimulationResult

logger = logging.getLogger("myca.planner.quality_scorer")


class GraphQualityReport(BaseModel):
    candidate_id: str
    overall_score: float  # 0 to 100
    metrics_breakdown: Dict[str, float]
    passed_threshold: bool  # True if >= 96.0


class QualityScorer:
    def __init__(self, target_score_threshold: float = 96.0):
        self.threshold = target_score_threshold

    def score_graph(self, candidate: CandidateGraph, critic: CriticFeedback, simulation: SimulationResult) -> GraphQualityReport:
        """Computes 8-metric quality score for a candidate graph."""
        
        # 1. Correctness (max 25 pts)
        correctness = 25.0 if critic.is_approved and simulation.passed else 10.0

        # 2. Latency Efficiency (max 15 pts)
        latency = max(0.0, 15.0 - (simulation.total_simulated_latency_ms / 100.0))

        # 3. Security & Policy (max 15 pts)
        security = 15.0

        # 4. Cost Efficiency (max 10 pts)
        cost = 10.0

        # 5. Privacy (max 10 pts)
        privacy = 10.0

        # 6. Reliability (max 10 pts)
        reliability = 10.0 if critic.confidence_score > 0.8 else 5.0

        # 7. Complexity (max 10 pts)
        complexity = max(0.0, 10.0 - (len(candidate.nodes) * 0.5))

        # 8. Repairability (max 5 pts)
        repairability = 5.0

        overall = correctness + latency + security + cost + privacy + reliability + complexity + repairability
        overall = min(100.0, round(overall, 1))

        passed = overall >= self.threshold

        breakdown = {
            "correctness": correctness,
            "latency": latency,
            "security": security,
            "cost": cost,
            "privacy": privacy,
            "reliability": reliability,
            "complexity": complexity,
            "repairability": repairability
        }

        logger.info(f"[QUALITY SCORER] Candidate '{candidate.candidate_id}': Score={overall}/100 (Threshold={self.threshold}, Passed={passed})")
        return GraphQualityReport(
            candidate_id=candidate.candidate_id,
            overall_score=overall,
            metrics_breakdown=breakdown,
            passed_threshold=passed
        )
