import pytest
import asyncio
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.skills.core.decorator import skill
from myca.execution.transport.base import ExecutionTask

@skill(id="offline_skill")
async def dummy_offline(ctx, data: str):
    return {"status": "ok", "result": f"Offline processed: {data}"}

@pytest.mark.asyncio
async def test_phase7_offline_mode():
    """
    PHASE 7: OFFLINE MODE
    No peers available in the network.
    Expected: Execution Bus falls back to LocalTransport without failing.
    """
    colony = SimulatedColony()
    # No remote nodes added
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    # Manually ensure no peers are in discovery (SimulatedDiscovery might have default mock peers)
    harness.node.discovery.peers = {}
    
    # Node A naturally has offline_skill since it's registered globally via @skill decorator,
    # but we make sure the mock _is_local_skill reflects this.
    harness.node.capabilities = ["offline_skill"]
    
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    # Track which transport executes
    bus = harness.node.runtime.execution_bus
    original_local_execute = bus.local_transport.execute
    original_remote_execute = bus.remote_transport.execute if bus.remote_transport else None
    
    local_executed = False
    remote_executed = False
    
    async def track_local(task: ExecutionTask, target_node: str = None):
        nonlocal local_executed
        local_executed = True
        return await original_local_execute(task, target_node)

    async def track_remote(task: ExecutionTask, target_node: str = None):
        nonlocal remote_executed
        remote_executed = True
        if original_remote_execute:
            return await original_remote_execute(task, target_node)
        
    bus.local_transport.execute = track_local
    if bus.remote_transport:
        bus.remote_transport.execute = track_remote

    executor = WorkflowExecutor(runtime=harness.node.runtime)

    dag = {
        "id": "flow-phase7",
        "name": "Phase 7 Offline",
        "nodes": [
            {"id": "N1", "skill": "offline_skill", "inputs": {"data": "secret data"}}
        ]
    }
    
    try:
        result = await executor.execute(dag)
        
        # Must complete successfully locally
        assert result["status"] == "Completed"
        assert "N1" in result["node_outputs"]
        assert result["node_outputs"]["N1"]["result"] == "Offline processed: secret data"
        
        # Verify it executed exactly on the local transport
        assert local_executed is True
        assert remote_executed is False
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        bus.local_transport.execute = original_local_execute
        if bus.remote_transport:
            bus.remote_transport.execute = original_remote_execute
            
        await harness.stop()
        await colony.stop_all()
