import logging
from typing import Any, Dict, AsyncGenerator
from .transport.base import Transport, ExecutionTask
from .transport.local import LocalTransport
from .transport.mock import MockTransport
from .capability import CapabilityManager
from myca.skills.core.result import SkillResult
from myca.skills.core.registry import SkillRegistry

logger = logging.getLogger("myca.execution.bus")

class ExecutionBus:
    """
    The Execution Bus is solely responsible for:
    - Capability discovery
    - Node selection
    - Transport routing (Local vs Remote)
    - Retries and failover
    
    The Runtime Scheduler interacts ONLY with the ExecutionBus.
    """
    
    def __init__(self, discovery_service=None, is_simulation=False):
        self.capability_manager = CapabilityManager(discovery_service)
        self.local_transport = LocalTransport()
        # In simulation mode, we use MockTransport for remote nodes
        self.remote_transport = MockTransport() if is_simulation else None # Will be WebRTCTransport
        
    def _is_local_skill(self, skill_id: str) -> bool:
        """Check if skill exists in the local registry."""
        try:
            SkillRegistry._ensure_loaded()
            return skill_id in SkillRegistry._skills
        except Exception:
            return False

    async def execute(self, task: ExecutionTask) -> SkillResult:
        """
        Executes a task dynamically routing it to the best node.
        Handles failover and retries internally.
        """
        # 1. Discover capabilities
        candidates = self.capability_manager.find_nodes_for_skill(task.skill_id)
        
        # 2. Check if local is an option (and often prioritize if same capability)
        can_run_locally = self._is_local_skill(task.skill_id)
        
        # If no peers have it, and we don't have it, we must fail.
        if not candidates and not can_run_locally:
            return SkillResult(success=False, logs=[f"Capability/Skill '{task.skill_id}' not found on any node."])
            
        # 3. Choose transport and node
        # For Phase 5 test, if a remote node has it and we don't, route remote.
        # If both have it, we could route local to save network.
        # But if the test says "process_data -> local, summarize_data -> remote", 
        # it implies the capability is strictly remote for summarize_data.
        
        target_node = None
        transport = self.local_transport
        
        if candidates and not can_run_locally:
            target_node = candidates[0].node_id
            transport = self.remote_transport
            logger.info(f"[EXECUTION BUS] Routing {task.skill_id} to REMOTE node {target_node}")
        elif candidates and can_run_locally:
            # If both have it, check score vs local penalty. For now default local.
            transport = self.local_transport
            logger.info(f"[EXECUTION BUS] Routing {task.skill_id} to LOCAL node (both capable)")
        else:
            transport = self.local_transport
            logger.info(f"[EXECUTION BUS] Routing {task.skill_id} to LOCAL node (fallback/only)")

        # 4. Execute with retries
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                res = await transport.execute(task, target_node)
                if res.success:
                    return res
                else:
                    logger.warning(f"[EXECUTION BUS] Task {task.skill_id} failed on {transport.name}. Attempt {attempt+1}/{max_retries}")
            except Exception as e:
                logger.error(f"[EXECUTION BUS] Transport exception on {transport.name}: {e}")
                
            # Basic failover logic
            if target_node and len(candidates) > attempt + 1:
                target_node = candidates[attempt + 1].node_id
                logger.info(f"[EXECUTION BUS] Failing over {task.skill_id} to node {target_node}")
            else:
                # If no more remote candidates, fallback local if possible
                if transport != self.local_transport and can_run_locally:
                    logger.info(f"[EXECUTION BUS] Failing over {task.skill_id} to LOCAL")
                    transport = self.local_transport
                    target_node = None
                else:
                    break # No more failover options
                    
        return SkillResult(success=False, logs=[f"Execution Bus failed to execute {task.skill_id} after {max_retries} retries."])

    async def stream(self, task: ExecutionTask) -> AsyncGenerator[Dict[str, Any], None]:
        # Same routing logic as execute, but yielding stream
        can_run_locally = self._is_local_skill(task.skill_id)
        candidates = self.capability_manager.find_nodes_for_skill(task.skill_id)
        
        target_node = None
        transport = self.local_transport
        
        if candidates and not can_run_locally:
            target_node = candidates[0].node_id
            transport = self.remote_transport
            
        async for event in transport.stream(task, target_node):
            yield event
