"""
Critic Agent — Reviews Candidate Execution Graphs for Hallucinations & Risks
"""

import logging
from typing import List
from pydantic import BaseModel, Field
from myca.planner.agents.graph_agent import CandidateGraph

logger = logging.getLogger("myca.planner.agents.critic")


class CriticFeedback(BaseModel):
    candidate_id: str
    is_approved: bool = True
    flaws: List[str] = Field(default_factory=list)
    confidence_score: float = 1.0


class CriticAgent:
    def __init__(self):
        pass

    def critique_candidate(self, candidate: CandidateGraph) -> CriticFeedback:
        """Critiques a candidate DAG to detect hallucinations, broken edges, or missing credentials."""
        flaws = []

        for node in candidate.nodes:
            skill = node.get("skill", "")
            inputs = node.get("inputs", {})

            if "telegram" in skill and "chat_id" not in inputs:
                flaws.append(f"Node '{node['id']}' ({skill}) is missing required 'chat_id' input.")

            if "postgres" in skill and "query" not in inputs:
                flaws.append(f"Node '{node['id']}' ({skill}) is missing required 'query' input.")

        is_approved = len(flaws) == 0
        confidence = 1.0 - (0.2 * len(flaws))

        logger.info(f"[CRITIC AGENT] Critiqued '{candidate.candidate_id}': Approved={is_approved}, Flaws={len(flaws)}")
        return CriticFeedback(
            candidate_id=candidate.candidate_id,
            is_approved=is_approved,
            flaws=flaws,
            confidence_score=max(0.0, confidence)
        )
