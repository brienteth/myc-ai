import pytest
import asyncio
import time
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.skills.core.decorator import skill

@skill(id="test.delay")
async def dummy_delay_skill(ctx, delay: float = 0.5):
    await asyncio.sleep(delay)
    return {"status": "ok"}


@pytest.mark.asyncio
async def test_phase3_dag_parallel():
    """
    PHASE 3: DAG PARALLEL EXECUTION
    A -> B, C
    B, C -> D
    Verify B and C run simultaneously.
    """
    harness = RuntimeTestHarness(node_id="test-phase3")
    await harness.start()

    executor = WorkflowExecutor(runtime=harness.node)

    dag = {
        "id": "flow-phase3",
        "name": "Phase 3 Parallel",
        "nodes": [
            {"id": "A", "skill": "test.delay", "inputs": {"delay": 0.1}},
            {"id": "B", "skill": "test.delay", "inputs": {"delay": 0.4}, "depends_on": ["A"]},
            {"id": "C", "skill": "test.delay", "inputs": {"delay": 0.4}, "depends_on": ["A"]},
            {"id": "D", "skill": "test.delay", "inputs": {"delay": 0.1}, "depends_on": ["B", "C"]}
        ]
    }

    try:
        t0 = time.time()
        result = await executor.execute(dag)
        t1 = time.time()
        
        assert result["status"] == "Completed"

        elapsed = t1 - t0
        
        # Sequential time would be: 0.1 (A) + 0.4 (B) + 0.4 (C) + 0.1 (D) = 1.0s
        # Parallel time should be: 0.1 (A) + max(0.4, 0.4) (B,C) + 0.1 (D) = 0.6s
        # We assert elapsed is significantly less than sequential.
        assert elapsed < 0.8, f"Execution took {elapsed:.2f}s, expected parallel execution (<0.8s)"
        
    finally:
        await harness.stop()
