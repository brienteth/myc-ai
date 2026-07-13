import asyncio
from typing import Any, Dict, AsyncGenerator
from .base import Transport, ExecutionTask
from myca.skills.core.result import SkillResult
from myca.skills.core.registry import SkillRegistry
import logging

logger = logging.getLogger("myca.execution.transport.mock")

class MockTransport(Transport):
    """
    Simulates remote execution for testing without real networking.
    Adds artificial latency to simulate network delays.
    """
    
    @property
    def name(self) -> str:
        return "mock_remote"

    async def execute(self, task: ExecutionTask, target_node: str = None) -> SkillResult:
        logger.info(f"[MOCK TRANSPORT] Sending {task.skill_id} to remote node '{target_node}'")
        
        # Simulate network latency
        await asyncio.sleep(0.05)
        
        # Execute locally to simulate remote execution success
        # In a real test, the target node would execute it, but since they share
        # the codebase, running it from the local registry works for basic mock.
        res = await SkillRegistry.execute(task.context, task.skill_id, **task.inputs)
        
        # Simulate network return latency
        await asyncio.sleep(0.05)
        
        logger.info(f"[MOCK TRANSPORT] Received result from '{target_node}'")
        return res

    async def stream(self, task: ExecutionTask, target_node: str = None) -> AsyncGenerator[Dict[str, Any], None]:
        yield {"status": "started", "skill_id": task.skill_id, "node": target_node}
        res = await self.execute(task, target_node)
        yield {"status": "completed", "result": res.model_dump(), "node": target_node}
