import pytest
import asyncio
from myca.testing.simulator import FakeCapabilityNode
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.skills.core.decorator import skill
from myca.skills.core.registry import SkillRegistry

# For the test, we mock the local capabilities
@skill(id="process_data")
async def dummy_process(ctx, data: str):
    return {"status": "ok", "processed": data.upper()}

# In a real environment, node A doesn't have summarize_data registered locally, but for simulation, 
# the MockTransport executes it locally while emitting the correct MockTransport logs.
@skill(id="summarize_data")
async def dummy_summarize(ctx, data: str):
    return {"status": "ok", "summary": f"Summary of {data}"}


@pytest.mark.asyncio
async def test_phase5_distributed_execution():
    """
    PHASE 5: DISTRIBUTED EXECUTION
    Node A: has process_data
    Node B: has summarize_data
    """
    colony = SimulatedColony()
    
    # We will simulate Node A as the harness node (test-phase5) and Node B as the remote node.
    node_b = FakeCapabilityNode(node_id="node-b", capabilities=["summarize_data"])
    colony.add_node(node_b)
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    # We manually override Node A's capabilities to ONLY have process_data
    harness.node.capabilities = ["process_data"]
    
    from myca.discovery import PeerInfo
    # Inject node-b into node-a's simulated discovery
    harness.node.discovery.peers["node-b"] = PeerInfo(
        node_id="node-b",
        role="worker",
        host="127.0.0.1",
        port=0,
        status="active",
        latency_ms=10.0,
        capabilities=["summarize_data"]
    )
    
    # Mock SkillRegistry so that _is_local_skill reflects node A's capabilities
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    executor = WorkflowExecutor(runtime=harness.node.runtime)

    dag = {
        "id": "flow-phase5",
        "name": "Phase 5 Distributed",
        "nodes": [
            {"id": "N1", "skill": "process_data", "inputs": {"data": "hello world"}},
            {"id": "N2", "skill": "summarize_data", "inputs": {"data": "hello world"}, "depends_on": ["N1"]}
        ]
    }
    
    try:
        result = await executor.execute(dag)
        assert result["status"] == "Completed"
        
        # Verify Node N1 output
        outputs = result["node_outputs"]
        assert "N1" in outputs
        assert "N2" in outputs
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
        await colony.stop_all()
