import pytest
import asyncio
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.automation.executor import WorkflowExecutor
from myca.planner.planner import Planner
from myca.skills.core.decorator import skill

@skill(id="fs.list")
async def dummy_fs_list(ctx, path: str):
    return {"status": "ok", "path": path}

@pytest.mark.asyncio
async def test_phase11_planner():
    """
    PHASE 11: PLANNER TEST
    Verify that the Planner translates a Natural Language Need into an Execution Graph (DAG),
    and that the Executor can successfully run this generated graph.
    """
    colony = SimulatedColony()
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = ["fs.list"]
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    try:
        # Initialize Planner (mocking inference backend)
        planner = Planner(inference_backend=None)
        
        # 1. Translate Need to DAG
        need_prompt = "Read the files in my current directory"
        dag = await planner.create_plan(need_prompt, available_skills=[{"id": "fs.list", "desc": "list files"}])
        
        # Format adapter: if planner outputs "deps", map to "depends_on" for executor compatibility
        for node in dag.get("nodes", []):
            if "deps" in node and "depends_on" not in node:
                node["depends_on"] = node["deps"]
                
        dag["id"] = "flow-phase11"
        dag["name"] = "Phase 11 Planner Generated Flow"
        
        # Verify planner output format
        assert len(dag["nodes"]) == 1
        assert dag["nodes"][0]["skill"] == "fs.list"
        
        # 2. Execute the generated DAG
        executor = WorkflowExecutor(runtime=harness.node.runtime)
        result = await executor.execute(dag)
        
        assert result["status"] == "Completed"
        assert result["node_outputs"]["A"]["path"] == "."
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
        await colony.stop_all()
