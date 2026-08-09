from typing import Dict, Any, List

class CandidateRuntime:
    def __init__(self, name: str, cost_multiplier: float, base_latency: float):
        self.name = name
        self.cost_multiplier = cost_multiplier
        self.base_latency = base_latency

class ExecutionOptimizer:
    """Evaluates candidate runtimes and calculates costs for a task."""
    
    RUNTIMES = {
        "LOCAL": CandidateRuntime("LOCAL", 0.0, 4.2),
        "0G_COMPUTE": CandidateRuntime("0G_COMPUTE", 0.004, 3.1),
        "COLONY": CandidateRuntime("COLONY", 0.008, 5.7),
        "ENTERPRISE_GPU": CandidateRuntime("ENTERPRISE_GPU", 0.031, 1.2)
    }

    @classmethod
    def evaluate(cls, intent: str, requires_privacy: bool = False) -> Dict[str, Any]:
        """Returns candidate runtimes and the selected optimal one."""
        
        candidates = []
        # Simulate base token count estimation based on intent length
        estimated_tokens = len(intent) * 50
        
        for name, rt in cls.RUNTIMES.items():
            if requires_privacy and name not in ["LOCAL", "ENTERPRISE_GPU"]:
                continue
                
            cost = estimated_tokens * rt.cost_multiplier / 1000.0
            
            candidates.append({
                "name": name,
                "cost": round(cost, 4),
                "latency": rt.base_latency
            })
            
        # Select best: Lowest cost among those with latency < 5.0s
        valid_candidates = [c for c in candidates if c["latency"] < 5.0]
        if not valid_candidates:
            valid_candidates = candidates
            
        selected = min(valid_candidates, key=lambda x: x["cost"])
        
        return {
            "candidates": candidates,
            "selected": selected
        }
