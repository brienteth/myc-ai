from enum import Enum
import time
import logging

logger = logging.getLogger(__name__)

class BiologicalPolicy(Enum):
    GROW = "grow"      # Establish new connections
    PRUNE = "prune"    # Drop unused connections
    SLEEP = "sleep"    # Suspend background tasks
    HEAL = "heal"      # Reconnect lost vital nodes

class PolicyEngine:
    """
    Applies biological policies to the Home Cluster.
    """
    def __init__(self, flow_layer):
        self.flow = flow_layer

    def evaluate(self):
        """Evaluate network state and apply policies."""
        bloom = self.flow.local_bloom
        
        if bloom.battery < 0.2:
            self.apply(BiologicalPolicy.SLEEP, "Battery critical (<20%)")
        
        # Prune logic: drop nodes inactive for 60s
        now = time.time()
        for peer_id, peer_bloom in list(self.flow.peer_blooms.items()):
            if now - peer_bloom.last_updated > 60:
                self.apply(BiologicalPolicy.PRUNE, f"Peer {peer_id} inactive")
                del self.flow.peer_blooms[peer_id]

    def apply(self, policy: BiologicalPolicy, reason: str):
        logger.info(f"Applying Biological Policy: {policy.value.upper()} - {reason}")
