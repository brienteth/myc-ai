import asyncio
import logging
from typing import Dict, Any, Optional

from myca.node import MycaNode

logger = logging.getLogger("myca.testing.harness")

class RuntimeTestHarness:
    """
    Test Harness for Myca Automation OS.
    Bootstraps an in-memory/isolated node for testing execution, planner, and DAG flows.
    """
    def __init__(self, node_id: str = "test-node-1", role: str = "inference"):
        self.node_id = node_id
        self.role = role
        self.node: Optional[MycaNode] = None
        self.events = []
        self._loop_task: Optional[asyncio.Task] = None

    async def _event_callback(self, event_type: str, data: Dict[str, Any]):
        self.events.append((event_type, data))
        logger.debug(f"[HARNESS] Captured event: {event_type}")

    async def start(self):
        self.node = MycaNode(
            node_id=self.node_id,
            role=self.role,
            port=0, # Random port
            simulate=True,
            data_dir=":memory:", # If applicable
            event_callback=self._event_callback
        )
        # Mock memory for executor context compatibility
        self.node.memory = {}
        await self.node.start()
        
        from myca.runtime import RuntimeEngine
        self.node.runtime = RuntimeEngine(self.node)
        
        logger.info("[HARNESS] Node started")

    async def stop(self):
        if self.node:
            await self.node.stop()
        logger.info("[HARNESS] Node stopped")

    def get_events(self, event_type: str = None) -> list:
        if event_type:
            return [e for e in self.events if e[0] == event_type]
        return self.events

    async def submit_need(self, need: str) -> dict:
        """
        Simulate submitting an intent/need directly to the planner.
        Returns the execution result or execution graph.
        """
        from myca.automation.planner import AutomationPlanner
        
        # Planning phase
        planner = AutomationPlanner(self.node.inference_engine)
        dag = await planner.plan_intent(need)
        logger.info(f"[HARNESS] Planned DAG: {dag.get('id')}")
        
        # Execution phase
        # Note: We will need to trigger execution via node's orchestrator or executor directly
        # For now, just return the DAG for validation
        return dag
