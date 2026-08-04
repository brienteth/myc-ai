import pytest
import asyncio
import time
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.skills.core.decorator import skill

@skill(id="perf_skill")
async def dummy_perf(ctx, data: str):
    await asyncio.sleep(0.01)
    return {"status": "ok", "processed": data}

@pytest.mark.asyncio
async def test_phase14_performance():
    """
    PHASE 14: PERFORMANCE TEST
    Execute a DAG with 50 parallel nodes and verify throughput.
    """
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = ["perf_skill"]
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    executor = WorkflowExecutor(runtime=harness.node.runtime)
    
    nodes = []
    for i in range(50):
        nodes.append({"id": f"N{i}", "skill": "perf_skill", "inputs": {"data": str(i)}})
        
    dag = {
        "id": "flow-phase14",
        "name": "Phase 14 Performance",
        "nodes": nodes
    }
    
    try:
        start_time = time.time()
        result = await executor.execute(dag)
        duration = time.time() - start_time
        
        assert result["status"] == "Completed"
        assert len(result["node_outputs"]) == 50
        
        # 50 nodes executing in parallel should take significantly less than 50 * 0.01 = 0.5s
        # Usually takes around 0.02 - 0.1s due to overhead
        assert duration < 0.3
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
