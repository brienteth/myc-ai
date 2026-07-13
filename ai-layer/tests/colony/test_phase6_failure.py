import pytest
import asyncio
from myca.testing.simulator import FakeCapabilityNode
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.skills.core.decorator import skill
from myca.execution.transport.base import ExecutionTask
from myca.discovery import PeerInfo

@skill(id="critical_skill")
async def dummy_critical(ctx, data: str):
    return {"status": "ok", "result": f"Done: {data}"}

@pytest.mark.asyncio
async def test_phase6_node_failure_failover():
    """
    PHASE 6: NODE FAILURE AND FAILOVER
    Node A: Orchestrator
    Node B: has critical_skill, but fails during execution.
    Node C: has critical_skill, succeeds.
    """
    colony = SimulatedColony()
    
    # Add Node B and Node C
    node_b = FakeCapabilityNode(node_id="node-b", capabilities=["critical_skill"])
    node_c = FakeCapabilityNode(node_id="node-c", capabilities=["critical_skill"])
    colony.add_node(node_b)
    colony.add_node(node_c)
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = [] # Node A doesn't have it
    
    harness.node.discovery.peers["node-b"] = PeerInfo(
        node_id="node-b", role="worker", host="127.0.0.1", port=0,
        status="active", latency_ms=10.0, capabilities=["critical_skill"]
    )
    # Node C has slightly higher latency so it gets ranked second
    harness.node.discovery.peers["node-c"] = PeerInfo(
        node_id="node-c", role="worker", host="127.0.0.1", port=0,
        status="active", latency_ms=15.0, capabilities=["critical_skill"]
    )
    
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    # Mock transport to simulate Node B failure
    bus = harness.node.runtime.execution_bus
    original_execute = bus.remote_transport.execute
    
    failover_trigger_count = 0
    
    async def failing_execute(task: ExecutionTask, target_node: str = None):
        nonlocal failover_trigger_count
        if target_node == "node-b":
            failover_trigger_count += 1
            raise ConnectionError("Node B connection lost during execution")
        return await original_execute(task, target_node)
        
    bus.remote_transport.execute = failing_execute

    executor = WorkflowExecutor(runtime=harness.node.runtime)

    dag = {
        "id": "flow-phase6",
        "name": "Phase 6 Failover",
        "nodes": [
            {"id": "N1", "skill": "critical_skill", "inputs": {"data": "mission critical"}}
        ]
    }
    
    try:
        result = await executor.execute(dag)
        
        # Must complete successfully despite Node B dying
        assert result["status"] == "Completed"
        assert "N1" in result["node_outputs"]
        assert result["node_outputs"]["N1"]["result"] == "Done: mission critical"
        
        # Verify it actually attempted Node B and failed over
        assert failover_trigger_count == 1
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        bus.remote_transport.execute = original_execute
        await harness.stop()
        await colony.stop_all()
