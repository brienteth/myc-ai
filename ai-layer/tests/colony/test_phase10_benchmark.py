import pytest
import asyncio
import time
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.skills.core.decorator import skill
from myca.execution.transport.base import ExecutionTask
from myca.discovery import PeerInfo

@skill(id="bench_skill")
async def dummy_bench(ctx, data: str):
    await asyncio.sleep(0.1) # simulate execution latency
    return {"status": "ok"}

@pytest.mark.asyncio
async def test_phase10_benchmark():
    """
    PHASE 10: BENCHMARK TEST
    Verify that ExecutionBus correctly measures and attaches latency metrics 
    (Dispatch, Transfer, Execution latency).
    """
    colony = SimulatedColony()
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = []
    harness.node.discovery.peers["node-b"] = PeerInfo(
        node_id="node-b", role="worker", host="127.0.0.1", port=0,
        status="active", latency_ms=10.0, capabilities=["bench_skill"]
    )
    
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    bus = harness.node.runtime.execution_bus

    from myca.skills.core.context import SkillContext
    mock_ctx = SkillContext(need_id="test_run", runtime=harness.node.runtime, memory={}, capabilities=None, permissions=[])

    task = ExecutionTask(
        skill_id="bench_skill",
        inputs={"data": "test"},
        task_id="T1",
        context=mock_ctx
    )
    
    try:
        start_time = time.time()
        res = await bus.execute(task)
        end_time = time.time()
        
        assert res.success is True
        
        # Verify metrics exist
        assert hasattr(res, "metrics")
        assert res.metrics is not None
        assert "latency_ms" in res.metrics
        
        # Total latency should be at least the 0.1s sleep inside the skill
        assert res.metrics["latency_ms"] >= 100.0
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
        await colony.stop_all()
