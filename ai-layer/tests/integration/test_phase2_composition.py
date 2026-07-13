import pytest
import asyncio
import time
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.skills.core.decorator import skill

@skill(id="test.delay")
async def dummy_delay_skill(ctx, delay: float = 0.1):
    await asyncio.sleep(delay)
    return {"status": "ok", "waited": delay}

@skill(id="dummy.browser.search")
async def browser_search(ctx, delay: float = 0.05):
    await asyncio.sleep(delay)
    return {"status": "ok", "waited": delay}

@skill(id="dummy.browser.goto")
async def browser_goto(ctx, delay: float = 0.05):
    await asyncio.sleep(delay)
    return {"status": "ok", "waited": delay}

@skill(id="dummy.browser.extract")
async def browser_extract(ctx, delay: float = 0.05):
    await asyncio.sleep(delay)
    return {"status": "ok", "waited": delay}

@skill(id="dummy.ai.summarize")
async def ai_summarize(ctx, delay: float = 0.05):
    await asyncio.sleep(delay)
    return {"status": "ok", "waited": delay}


@pytest.mark.asyncio
async def test_phase2_skill_composition():
    """
    PHASE 2: SKILL COMPOSITION TEST
    Verify that a composed DAG runs without recursion via the executor.
    """
    harness = RuntimeTestHarness(node_id="test-phase2")
    await harness.start()

    executor = WorkflowExecutor(runtime=harness.node)

    # Compose: browser.search -> browser.goto -> browser.extract -> ai.summarize
    dag = {
        "id": "flow-phase2",
        "name": "Phase 2 Composition",
        "nodes": [
            {"id": "N1", "skill": "dummy.browser.search", "inputs": {"delay": 0.05}},
            {"id": "N2", "skill": "dummy.browser.goto", "inputs": {"delay": 0.05}, "depends_on": ["N1"]},
            {"id": "N3", "skill": "dummy.browser.extract", "inputs": {"delay": 0.05}, "depends_on": ["N2"]},
            {"id": "N4", "skill": "dummy.ai.summarize", "inputs": {"delay": 0.05}, "depends_on": ["N3"]}
        ]
    }

    try:
        result = await executor.execute(dag)
        assert result["status"] == "Completed"
        # All outputs must exist
        outputs = result["node_outputs"]
        assert "N1" in outputs and "N2" in outputs and "N3" in outputs and "N4" in outputs
    finally:
        await harness.stop()
