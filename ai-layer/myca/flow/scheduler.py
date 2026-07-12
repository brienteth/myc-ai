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
        """Calculate a single routing score based on flow dimensions."""
        score = 0.0
        
        # Battery dimension (avoid dead nodes)
        if bloom.battery < 0.2:
            return -1.0 # Impossible to route
            
        score += bloom.battery * 10
        
        # Latency dimension (prefer closer nodes)
        # Latency is usually small, so we penalize high latency
        score -= bloom.latency * 100 
        
        # Skill / Knowledge dimension
        # Check if the node advertises the required skills in its knowledge topics or models
        overlap = sum(1 for skill in intent.required_skills if skill in bloom.knowledge_topics or skill in bloom.models)
        score += overlap * 20
        
        # Trust / Experience
        score *= bloom.trust_score
        
        return score

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
