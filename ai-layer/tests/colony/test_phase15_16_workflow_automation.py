import pytest
import asyncio
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.automation.history import AutomationDB
from myca.skills.core.decorator import skill

@skill(id="db_skill")
async def dummy_db_skill(ctx, val: str):
    return {"status": "ok", "val": val}

@pytest.mark.asyncio
async def test_phase15_16_workflow_and_automation():
    """
    PHASE 15 & 16: WORKFLOW & AUTOMATION DB TEST
    Execute a complex workflow and verify all node executions are logged to AutomationDB.
    """
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = ["db_skill"]
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    AutomationDB.init_db()
    executor = WorkflowExecutor(runtime=harness.node.runtime)
    
    dag = {
        "id": "flow-phase15-16",
        "name": "Phase 15 Workflow",
        "nodes": [
            {"id": "A", "skill": "db_skill", "inputs": {"val": "1"}},
            {"id": "B", "skill": "db_skill", "inputs": {"val": "2"}, "depends_on": ["A"]}
        ]
    }
    
    try:
        result = await executor.execute(dag)
        assert result["status"] == "Completed"
        
        runs = AutomationDB.get_history()
        # Find our run
        my_run = next((r for r in runs if r["id"] == result["run_id"]), None)
        assert my_run is not None
        assert my_run["status"] == "Completed"
        
        nodes = my_run["nodes"]
        assert len(nodes) == 2
        
        node_ids = {n["node_id"] for n in nodes}
        assert "A" in node_ids
        assert "B" in node_ids
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
