from dataclasses import dataclass
from typing import List, Optional
import random

@dataclass
class NodeScore:
    node_id: str
    score: float
    latency: float

class CapabilityManager:
    """
    Manages node capabilities and scores them based on availability, latency, etc.
    """
    
    def __init__(self, discovery_service):
        self.discovery = discovery_service

    def find_nodes_for_skill(self, skill_id: str) -> List[NodeScore]:
        """
        Discovers and ranks nodes that can execute the given skill.
        Returns a list of NodeScore sorted by highest score first.
        """
        if not self.discovery:
            return []

        # Get all active peers
        peers = self.discovery.get_active_peers()
        import logging
        logger = logging.getLogger("myca.execution.capability")
        logger.debug(f"[CAPABILITY] Found {len(peers)} peers. Skill needed: {skill_id}")
        if not peers:
            return []
            
        candidates = []
        for peer in peers:
            caps = getattr(peer, "capabilities", [])
            logger.debug(f"[CAPABILITY] Peer {getattr(peer, 'node_id', 'unknown')} has caps: {caps}")
            # Some tests might pass skill directly as a capability, or use skill manifest
            if skill_id in caps or skill_id.split(".")[-1] in caps:
                # Rank logic based on latency + success_rate + gpu + queue + energy + trust
                # For now, simplistic score based on latency
                latency = getattr(peer, "latency_ms", random.uniform(5, 50))
                # Lower latency = higher score (invert latency for scoring)
                base_score = 1000.0 / (latency + 1.0)
                
                candidates.append(NodeScore(
                    node_id=peer.node_id,
                    score=base_score,
                    latency=latency
                ))
                
        # Sort by score descending
        candidates.sort(key=lambda x: x.score, reverse=True)
        return candidates
