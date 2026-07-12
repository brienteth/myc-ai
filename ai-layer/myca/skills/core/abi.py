"""
Myca Skill ABI (Application Binary Interface)
Defines the language-independent execution schemas, manifest structures, and types.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ExecutionCost(BaseModel):
    """Estimated resource execution cost computed before run."""
    estimated_latency_ms: float = 0.0
    estimated_energy_score: float = 1.0  # relative energy score
    estimated_memory_mb: float = 0.0
    estimated_network_kb: float = 0.0
    estimated_cpu_pct: float = 0.0
    estimated_gpu_pct: float = 0.0

class SkillManifest(BaseModel):
    """Manifest v2 defining metadata, permissions, dependencies, and traits."""
    id: str
    version: str
    min_runtime: str = "0.1.0"
    max_runtime: Optional[str] = None
    author: str = "unknown"
    license: str = "MIT"
    homepage: Optional[str] = None
    repository: Optional[str] = None
    checksum: Optional[str] = None
    signature: Optional[str] = None
    description: str = ""
    category: str = "general"
    tags: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    traits: List[str] = Field(default_factory=list)
    requirements: Dict[str, Any] = Field(default_factory=dict)
    timeout: int = 30  # seconds
    retry: int = 0
    examples: List[Dict[str, Any]] = Field(default_factory=list)

class Artifact(BaseModel):
    """First-class runtime artifact representation."""
    id: str
    type: str  # text, image, audio, video, pdf, spreadsheet, archive, browser_screenshot, dom_snapshot, json
    mime: str
    path: str
    hash: str
    size: int
    preview: Optional[str] = None
    created_at: float = Field(default_factory=lambda: 0.0)  # time.time() initialized at instantiation

class SkillEvent(BaseModel):
    """Universal Event format emitted by all skills."""
    event_type: str  # Started, Progress, Log, Artifact, Metric, Warning, Recovery, Completed, Cancelled, Failed
    need_id: str
    skill_id: str
    timestamp: float
    payload: Dict[str, Any] = Field(default_factory=dict)

class SkillABI:
    """
    Abstract Base Class for all skill implementations.
    Every skill must implement this contract.
    """
    manifest: SkillManifest
    inputs_schema: type[BaseModel]
    outputs_schema: type[BaseModel]

    def estimate(self, inputs: BaseModel) -> ExecutionCost:
        """Calculate resource/execution costs before running the skill."""
        return ExecutionCost()

    async def execute(self, ctx: Any, inputs: BaseModel) -> BaseModel:
        """Run the actual skill execution logic."""
        raise NotImplementedError("Skills must implement execute()")
