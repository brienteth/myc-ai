import uuid
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ExecutionBudget(BaseModel):
    max_tokens: int = 100000
    max_cost_usd: float = 2.0
    max_runtime_seconds: int = 600
    max_iterations: int = 10
    max_parallel_agents: int = 5
    
    current_tokens: int = 0
    current_cost_usd: float = 0.0
    start_time: float = Field(default_factory=time.time)

class VerificationRule(BaseModel):
    rule_type: str  # correctness, freshness, source_validity, schema
    criteria: str
    threshold: float = 90.0
    severity: str = "HIGH"  # HIGH, MEDIUM, LOW

class AgentDefinition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    purpose: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    tools: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    runtime: str = "local"
    model_policy: str = "LOCAL_FIRST"
    budget: ExecutionBudget = Field(default_factory=ExecutionBudget)
    verification_policy: List[VerificationRule] = Field(default_factory=list)

class LoopConfig(BaseModel):
    enabled: bool = True
    max_iterations: int = 3
    success_threshold: float = 96.0
    timeout_seconds: int = 300
    stop_on_success: bool = True
    repair_strategy: str = "AUTO"

class GraphDefinition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, str]] = Field(default_factory=list)
    entry_nodes: List[str] = Field(default_factory=list)
    terminal_nodes: List[str] = Field(default_factory=list)
