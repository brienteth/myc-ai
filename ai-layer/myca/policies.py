import time
from typing import List
from .need import Need, Capability, ExecutionCost, PrivacyLevel

class BasePolicy:
    """Base policy that evaluates constraints and provides an execution cost."""
    def evaluate(self, need: Need, candidate: Capability, base_cost: ExecutionCost) -> ExecutionCost:
        raise NotImplementedError

class PrivacyPolicy(BasePolicy):
    def evaluate(self, need: Need, candidate: Capability, base_cost: ExecutionCost) -> ExecutionCost:
        # If need requires LOCAL_ONLY, but candidate is from network
        if need.privacy == PrivacyLevel.LOCAL_ONLY and candidate.cell_id != "local":
            base_cost.privacy += 1000  # huge penalty, effectively disallowing
            return base_cost

        if need.privacy == PrivacyLevel.LOCAL_NETWORK and candidate.source == "h3_global":
            base_cost.privacy += 1000
            return base_cost

        # Otherwise add a slight penalty for data leaving the node
        if candidate.cell_id != "local":
            base_cost.privacy += 10
            
        return base_cost

class EnergyPolicy(BasePolicy):
    def evaluate(self, need: Need, candidate: Capability, base_cost: ExecutionCost) -> ExecutionCost:
        if candidate.cell_id == "local":
            # Using local battery/gpu costs energy
            base_cost.energy += 15
        else:
            # Offloading saves local energy
            base_cost.energy += 5
            
        if need.max_energy == "minimum" and candidate.cell_id == "local":
            base_cost.energy += 100  # Penalize local execution if user wants min energy
            
        return base_cost

class LatencyPolicy(BasePolicy):
    def evaluate(self, need: Need, candidate: Capability, base_cost: ExecutionCost) -> ExecutionCost:
        # Calculate expected latency based on model loaded status, load, tokens/sec
        expected_latency = 0
        if not candidate.model_loaded:
            expected_latency += 2000  # penalty for needing to load
            
        if candidate.load_pct > 0:
            expected_latency += (candidate.load_pct * 10)
            
        base_cost.latency += expected_latency
        
        # If it exceeds the absolute maximum latency allowed by the need
        if base_cost.latency > need.max_latency_ms:
            base_cost.latency += 5000  # Heavy penalty for violating deadline
            
        return base_cost

class QualityPolicy(BasePolicy):
    def evaluate(self, need: Need, candidate: Capability, base_cost: ExecutionCost) -> ExecutionCost:
        # Check if candidate can do the action
        if need.action not in candidate.can_do and "chat" not in candidate.can_do:
            base_cost.compute += 1000  # Cannot do this action
            
        return base_cost

class OfflinePolicy(BasePolicy):
    def evaluate(self, need: Need, candidate: Capability, base_cost: ExecutionCost) -> ExecutionCost:
        # If candidate is stale/offline
        if time.time() - candidate.last_seen > 5:
            base_cost.availability += 1000
        return base_cost

class PolicyEngine:
    def __init__(self):
        self.policies = [
            PrivacyPolicy(),
            EnergyPolicy(),
            LatencyPolicy(),
            QualityPolicy(),
            OfflinePolicy(),
        ]
        
    def apply_all(self, need: Need, candidate: Capability, initial_cost: ExecutionCost) -> ExecutionCost:
        cost = initial_cost
        for policy in self.policies:
            cost = policy.evaluate(need, candidate, cost)
        return cost
