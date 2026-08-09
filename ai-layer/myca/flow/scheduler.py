import logging
from typing import Optional
from myca.flow.layer import FlowLayer, ResourceBloom
from myca.intent.engine import Intent

logger = logging.getLogger(__name__)

class FlowScheduler:
    """
    Multi-dimensional routing. 
    Compares Latency, Energy, Model Locality, Battery, and Experience.
    """
    def __init__(self, flow_layer: FlowLayer):
        self.flow = flow_layer

    def score_bloom_for_intent(self, bloom: ResourceBloom, intent: Intent) -> float:
        """Calculate a single routing score based on Mycelium Score, capability alignment, and trust."""
        # 1. Mycelium Score calculation (0-100 representation of device suitability)
        mycelium_score = 50.0
        
        # 1.1 Hardware speed (tps benchmarks)
        if bloom.tokens_per_second > 0.0:
            mycelium_score += min(15.0, bloom.tokens_per_second / 2.0)
            
        # 1.2 Battery level
        if bloom.battery < 0.15:
            return -1.0  # Critically low battery - do not route to this node
        mycelium_score += bloom.battery * 15.0
        
        # 1.3 Latency penalty (prefer closer/local nodes)
        latency_ms = bloom.latency * 1000.0  # Convert to ms
        if latency_ms > 10.0:
            penalty = min(15.0, (latency_ms - 10.0) / 10.0)
            mycelium_score -= penalty
            
        # 1.4 LAN bonus (mDNS local discovery is faster/more private)
        if latency_ms <= 15.0:
            mycelium_score += 10.0
            
        # 2. Skill & Knowledge Capability Matching
        overlap = sum(1 for skill in intent.required_skills if skill in bloom.knowledge_topics or skill in bloom.models)
        skill_score = overlap * 25.0
        
        # 3. Final compound routing score weighted by Trust & Experience
        total_score = (mycelium_score + skill_score) * bloom.trust_score
        
        return total_score

    def route(self, intent: Intent) -> Optional[ResourceBloom]:
        """Find the optimal flow destination for an intent."""
        best_score = -1.0
        best_bloom = None
        
        # Include local node in evaluation
        candidates = list(self.flow.peer_blooms.values())
        candidates.append(self.flow.local_bloom)
        
        for bloom in candidates:
            score = self.score_bloom_for_intent(bloom, intent)
            if score > best_score:
                best_score = score
                best_bloom = bloom
                
        if best_bloom:
            logger.info(f"Flow Scheduler routed intent '{intent.action}' to node '{best_bloom.node_id}' with score {best_score:.2f}")
        else:
            logger.warning(f"Flow Scheduler could not find a suitable node for intent '{intent.action}'")
            
        return best_bloom
