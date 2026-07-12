import time
from typing import Dict, Any, List

class ResourceBloom:
    """
    Represents the unified state of a node's resources (Knowledge, Models, GPU, Battery, Trust).
    Instead of discrete properties, it acts as a 'bloom filter' of capabilities for the Flow Layer.
    """
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.last_updated = time.time()
        self.battery = 1.0
        self.latency = 0.0
        self.gpu_available = False
        self.models: List[str] = []
        self.knowledge_topics: List[str] = []
        self.trust_score = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "last_updated": self.last_updated,
            "battery": self.battery,
            "latency": self.latency,
            "gpu": self.gpu_available,
            "models": self.models,
            "knowledge": self.knowledge_topics,
            "trust": self.trust_score
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ResourceBloom":
        bloom = cls(data["node_id"])
        bloom.last_updated = data.get("last_updated", time.time())
        bloom.battery = data.get("battery", 1.0)
        bloom.latency = data.get("latency", 0.0)
        bloom.gpu_available = data.get("gpu", False)
        bloom.models = data.get("models", [])
        bloom.knowledge_topics = data.get("knowledge", [])
        bloom.trust_score = data.get("trust", 1.0)
        return bloom

class FlowLayer:
    """
    Manages continuous flow optimization based on Resource Blooms.
    Replaces traditional gossip with Delta-Sync over the Home Cluster.
    """
    def __init__(self, local_node_id: str):
        self.local_node_id = local_node_id
        self.local_bloom = ResourceBloom(local_node_id)
        self.peer_blooms: Dict[str, ResourceBloom] = {}

    def update_local_bloom(self, updates: Dict[str, Any]):
        """Update local resources and bump timestamp."""
        for key, value in updates.items():
            if hasattr(self.local_bloom, key):
                setattr(self.local_bloom, key, value)
        self.local_bloom.last_updated = time.time()

    def receive_delta(self, peer_id: str, bloom_data: Dict[str, Any]):
        """Receive a Delta-Sync update from a peer."""
        self.peer_blooms[peer_id] = ResourceBloom.from_dict(bloom_data)
