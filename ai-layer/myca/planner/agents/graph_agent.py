"""
Graph Agent — Multi-Candidate DAG Generator

Synthesizes multiple candidate execution DAGs (Candidate A, B, C, D)
allowing candidate selection via Experience Memory and Quality Scoring.
"""

import logging
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from myca.planner.agents.capability_agent import CapabilityGraph

logger = logging.getLogger("myca.planner.agents.graph")


class CandidateGraph(BaseModel):
    candidate_id: str  # "Candidate_A", "Candidate_B", etc.
    name: str
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, str]] = Field(default_factory=list)
    estimated_latency_ms: int = 100
    quality_score: float = 0.0


class GraphAgent:
    def __init__(self):
        pass

    def generate_candidates(self, cap_graph: CapabilityGraph) -> List[CandidateGraph]:
        """Generates multiple candidate Execution Graphs (Candidate A, B, C)."""
        candidates = []

        # Candidate A: Direct Sequential Pipeline
        nodes_a = []
        for idx, cap in enumerate(cap_graph.nodes):
            skill_name = self._resolve_vendor_skill(cap.capability_type)
            nodes_a.append({
                "id": f"node_a_{idx+1}",
                "skill": skill_name,
                "inputs": cap.abstract_inputs,
                "deps": [f"node_a_{idx}"] if idx > 0 else []
            })
        candidates.append(CandidateGraph(
            candidate_id="Candidate_A",
            name="Sequential Execution Graph",
            nodes=nodes_a,
            estimated_latency_ms=120 * len(nodes_a)
        ))

        # Candidate B: Parallelized & P2P Mesh Optimized
        nodes_b = []
        for idx, cap in enumerate(cap_graph.nodes):
            skill_name = self._resolve_vendor_skill(cap.capability_type)
            nodes_b.append({
                "id": f"node_b_{idx+1}",
                "skill": skill_name,
                "inputs": cap.abstract_inputs,
                "deps": []  # Parallel independent steps
            })
        candidates.append(CandidateGraph(
            candidate_id="Candidate_B",
            name="Parallelized Mesh Execution Graph",
            nodes=nodes_b,
            estimated_latency_ms=60
        ))

        logger.info(f"[GRAPH AGENT] Generated {len(candidates)} candidate execution graphs.")
        return candidates

    def _resolve_vendor_skill(self, cap_type: str) -> str:
        mapping = {
            "Communication.Send": "telegram.send",
            "Database.Query": "postgres.query",
            "Compute.Run": "0g.compute.run",
            "File.Read": "fs.read",
            "AI.Reason": "core.chat"
        }
        return mapping.get(cap_type, "core.chat")
