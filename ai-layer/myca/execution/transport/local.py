from typing import Any, Dict, AsyncGenerator
from .base import Transport, ExecutionTask
from myca.skills.core.result import SkillResult
from myca.skills.core.registry import SkillRegistry
import logging

logger = logging.getLogger("myca.execution.transport.local")

class LocalTransport(Transport):
    """
    Executes skills locally using the SkillRegistry.
    No networking involved.
    """
    
    @property
    def name(self) -> str:
        return "local"

    async def execute(self, task: ExecutionTask, target_node: str = None) -> SkillResult:
        logger.debug(f"[LOCAL TRANSPORT] Executing {task.skill_id} locally.")
        return await SkillRegistry.execute(task.context, task.skill_id, **task.inputs)

    async def stream(self, task: ExecutionTask, target_node: str = None) -> AsyncGenerator[Dict[str, Any], None]:
        # Local streaming not fully implemented yet, yield basic execution progress
        yield {"status": "started", "skill_id": task.skill_id}
        res = await self.execute(task, target_node)
        yield {"status": "completed", "result": res.model_dump()}
