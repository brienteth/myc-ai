"""
Workflow Pydantic Models (Phase 3.0)
Defines the schema for nodes, edges, variables, and workflows.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class WorkflowNode(BaseModel):
    id: str
    skill: str
    inputs: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)
    timeout: int = 30  # seconds
    retry: int = 0
    parallel: bool = False
    continue_on_error: bool = False
    cache: bool = True
    condition: Optional[str] = None  # python-like evaluation expression

class WorkflowEdge(BaseModel):
    from_node: str = Field(..., alias="from")
    to_node: str = Field(..., alias="to")
    condition: Optional[str] = None
    label: Optional[str] = None

    class Config:
        populate_by_name = True

class Workflow(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool = True
    trigger: Dict[str, Any] = Field(default_factory=dict)  # {"type": "cron"/"clipboard"/..., "value": "..."}
    nodes: List[WorkflowNode] = Field(default_factory=list)
    edges: List[WorkflowEdge] = Field(default_factory=list)
    variables: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)
    version: str = "1.0.0"
    created_at: float = Field(default_factory=lambda: 0.0)
    updated_at: float = Field(default_factory=lambda: 0.0)
