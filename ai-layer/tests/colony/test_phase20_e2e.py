import pytest
import asyncio
from myca.testing.harness import RuntimeTestHarness
from myca.testing.colony import SimulatedColony
from myca.discovery import PeerInfo
from myca.automation.history import AutomationDB
from myca.skills.core.decorator import skill

@skill(id="fetch_data")
async def dummy_fetch(ctx, url: str):
    return {"status": "ok", "data": f"Data from {url}"}

@skill(id="process_data")
async def dummy_process(ctx, raw_data: str):
    return {"status": "ok", "result": raw_data.upper()}

@pytest.mark.asyncio
async def test_phase20_e2e():
    """
    PHASE 20: END TO END DEMO
    Tests the complete pipeline:
    1. Runtime receives a need (simulated via planner)
    2. DAG is generated
    3. Executor runs the DAG
    4. CapabilityManager maps skills to nodes
    5. ExecutionBus delegates one skill locally, one remotely
    6. Outputs are captured
    7. Results logged to AutomationDB
    """
    colony = SimulatedColony()
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    AutomationDB.init_db()
    
    # Setup network topology
    # Local node can process data
    harness.node.capabilities = ["process_data"]
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    # Remote worker can fetch data
    harness.node.discovery.peers["worker-1"] = PeerInfo(
        node_id="worker-1", role="worker", host="127.0.0.1", port=0,
        status="active", latency_ms=10.0, capabilities=["fetch_data"]
    )
    
    try:
        # 1 & 2. Planner translation (simulated here)
        dag = {
            "id": "flow-phase20",
            "name": "Phase 20 E2E Flow",
            "nodes": [
                {"id": "A", "skill": "fetch_data", "inputs": {"url": "https://api.example"}},
                {"id": "B", "skill": "process_data", "inputs": {"raw_data": "{{nodes.A.data}}"}, "depends_on": ["A"]}
            ]
        }
        
        from myca.automation.executor import WorkflowExecutor
        executor = WorkflowExecutor(runtime=harness.node.runtime)
        # 3. Execution
        result = await executor.execute(dag)
        
        # 6. Outputs Captured
        assert result["status"] == "Completed"
        assert result["node_outputs"]["A"]["data"] == "Data from https://api.example"
        assert result["node_outputs"]["B"]["result"] == "DATA FROM HTTPS://API.EXAMPLE"
        
        # 7. Verification in DB
        runs = AutomationDB.get_history()
        my_run = next((r for r in runs if r["id"] == result["run_id"]), None)
        assert my_run is not None
        assert my_run["status"] == "Completed"
        
        nodes = my_run["nodes"]
        assert len(nodes) == 2
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
        await colony.stop_all()
