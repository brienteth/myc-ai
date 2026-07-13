from abc import ABC, abstractmethod
from typing import Any, Dict, AsyncGenerator
from myca.skills.core.result import SkillResult

class ExecutionTask:
    """Represents a request to execute a skill."""
    def __init__(self, skill_id: str, inputs: Dict[str, Any], task_id: str, context: Any = None):
        self.skill_id = skill_id
        self.inputs = inputs
        self.task_id = task_id
        self.context = context  # e.g., SkillContext

class Transport(ABC):
    """
    Abstract base class for all execution transports.
    The Runtime never interacts with transports directly.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    async def execute(self, task: ExecutionTask, target_node: str = None) -> SkillResult:
        """Execute a skill and return the final result."""
        pass

    @abstractmethod
    async def stream(self, task: ExecutionTask, target_node: str = None) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute a skill and yield streaming progress/results."""
        yield {}
