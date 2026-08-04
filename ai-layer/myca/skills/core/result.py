"""
Skill Result
Standardized OS-level return object for every Skill execution.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Any

@dataclass
class SkillResult:
    success: bool
    outputs: Dict[str, Any] = field(default_factory=dict)
    artifacts: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict) # e.g. {"latency_ms": 120, "energy_cost": 1.5}
    logs: List[str] = field(default_factory=list)
    next_actions: List[str] = field(default_factory=list)
    recoverable: bool = False
    cacheable: bool = True

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "outputs": self.outputs,
            "artifacts": self.artifacts,
            "warnings": self.warnings,
            "metrics": self.metrics,
            "logs": self.logs,
            "next_actions": self.next_actions,
            "recoverable": self.recoverable,
            "cacheable": self.cacheable
        }
