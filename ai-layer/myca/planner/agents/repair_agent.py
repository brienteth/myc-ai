"""
Repair Agent — Automatic Graph Repair Loop
"""

import logging
from typing import Dict, Any
from myca.planner.agents.graph_agent import CandidateGraph
from myca.planner.agents.critic_agent import CriticFeedback

logger = logging.getLogger("myca.planner.agents.repair")


class RepairAgent:
    def __init__(self):
        pass

    def repair_graph(self, candidate: CandidateGraph, feedback: CriticFeedback) -> CandidateGraph:
        """Iteratively repairs flaws in candidate DAGs identified by CriticAgent."""
        if feedback.is_approved:
            return candidate

        repaired_nodes = []
        for node in candidate.nodes:
            n = dict(node)
            skill = n.get("skill", "")
            inputs = dict(n.get("inputs", {}))

            # Auto-repair Telegram missing chat_id
            if "telegram" in skill and "chat_id" not in inputs:
                inputs["chat_id"] = "@myca_sovereign_alerts"
                logger.info(f"[REPAIR AGENT] Repaired node '{n['id']}': Injected default 'chat_id'.")

            # Auto-repair Postgres missing query
            if "postgres" in skill and "query" not in inputs:
                inputs["query"] = "SELECT 1;"
                logger.info(f"[REPAIR AGENT] Repaired node '{n['id']}': Injected fallback SQL query.")

            n["inputs"] = inputs
            repaired_nodes.append(n)

        candidate.nodes = repaired_nodes
        logger.info(f"[REPAIR AGENT] Completed graph repair cycle for '{candidate.candidate_id}'.")
        return candidate
