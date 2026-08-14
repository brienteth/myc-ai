"""
Autonomous Learning & Evolution Engine

Captures real-world execution metrics (latency, retries, errors, human edits)
and updates Knowledge OS templates and Experience Memory.
"""

import logging
import asyncio
from typing import Dict, Any, List

logger = logging.getLogger("myca_intelligence.planner.learning_engine")


class LearningEngine:
    def __init__(self):
        self.experience_memory: List[Dict[str, Any]] = []
        self.local_learning_queue: List[Dict[str, Any]] = []  # Local queue for offline buffers

    def record_execution_outcome(self, graph_id: str, success: bool, latency_ms: float, retries: int):
        """Records execution outcome to evolve Knowledge OS templates for future planning."""
        record = {
            "graph_id": graph_id,
            "success": success,
            "latency_ms": latency_ms,
            "retries": retries,
            "experience_score": 0.98 if success else 0.40
        }
        self.experience_memory.append(record)
        logger.info(f"[LEARNING ENGINE] Logged execution metrics for '{graph_id}': Success={success}, Latency={latency_ms}ms")
        
        # 1. Prepare anonymized Federated Update (Privacy Filter)
        # We do NOT send raw user prompt data/documents. We send model/structural adaptation metrics.
        federated_update = self.prepare_federated_update(graph_id, success, latency_ms)
        self.local_learning_queue.append(federated_update)
        
        # 2. Try to sync queued updates to global learning registry
        asyncio.create_task(self.sync_updates_if_online())

    def prepare_federated_update(self, graph_id: str, success: bool, latency_ms: float) -> Dict[str, Any]:
        """
        Filters raw data (Privacy Filter) and prepares a lightweight adapter weight update signal.
        In production, this represents a LoRA/adapter update or structured capability reinforcement feedback.
        """
        import uuid
        import time
        return {
            "update_id": f"upd_{uuid.uuid4().hex[:12]}",
            "timestamp": time.time(),
            "metric": "execution_routing_reinforcement",
            "payload": {
                "graph_id": graph_id,
                "success_flag": success,
                "latency_penalty": max(0.0, latency_ms - 200.0),
                "adapt_weights": [0.05 if success else -0.1, 0.02, 0.01]
            }
        }

    async def sync_updates_if_online(self):
        """
        Synchronizes queued updates to Global Learning Cloud when online.
        If offline, keeps them queued locally.
        """
        if not self.local_learning_queue:
            return
            
        import os
        import httpx
        api_url = os.getenv("OPACUS_H3_URL", "")
        if not api_url:
            return
            
        logger.info(f"[LEARNING SYNC] Attempting to sync {len(self.local_learning_queue)} pending federated updates...")
        payload = {
            "updates": self.local_learning_queue
        }
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{api_url}/api/learning/sync", json=payload, timeout=5.0)
                if resp.status_code == 200:
                    logger.info(f"[LEARNING SYNC] Successfully uploaded {len(self.local_learning_queue)} updates. Local queue cleared.")
                    self.local_learning_queue.clear()
                else:
                    logger.warning(f"[LEARNING SYNC] Global registry returned status {resp.status_code}. Updates queued.")
        except Exception as e:
            logger.info(f"[LEARNING SYNC] System offline or registry unreachable ({e}). Pending updates safely queued locally.")

    def get_best_historical_score(self, intent_type: str) -> float:
        """Returns historical success score for candidate ranking."""
        if not self.experience_memory:
            return 0.95
        scores = [r["experience_score"] for r in self.experience_memory]
        return sum(scores) / len(scores)
