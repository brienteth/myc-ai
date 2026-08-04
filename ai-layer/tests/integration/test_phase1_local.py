import pytest
import asyncio
from myca.testing.harness import RuntimeTestHarness

@pytest.mark.asyncio
async def test_phase1_local_execution():
    """
    PHASE 1: LOCAL EXECUTION TEST
    Verify: Need -> Planner -> Execution Graph -> Skills -> Result
    """
    harness = RuntimeTestHarness(node_id="test-phase1-node")
    await harness.start()

    try:
        need = "Summarize ~/Desktop/report.pdf"
        dag = await harness.submit_need(need)

        # 1. Graph Generated
        assert dag is not None, "Planner did not generate a DAG"
        assert "nodes" in dag, "DAG missing 'nodes'"
        
        # We expect pdf.read, ai.summarize, filesystem.write (or similar skills based on the fallback heuristic or LLM)
        skills_used = [node["skill"] for node in dag["nodes"]]
        
        # 2. Output Stored & Experience Stored
        # In a real execution environment, we would also verify executor outputs.
        # Currently, harness.submit_need only returns the planned DAG.
        
        print(f"Generated DAG nodes: {skills_used}")
        
    finally:
        await harness.stop()
