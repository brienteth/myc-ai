import pytest
import asyncio
from myca.testing.simulator import FakeCapabilityNode
from myca.testing.colony import SimulatedColony
from myca.automation.planner import AutomationPlanner
from myca.testing.harness import RuntimeTestHarness

@pytest.mark.asyncio
async def test_phase4_capability_graph():
    """
    PHASE 4: CAPABILITY GRAPH
    Create 3 simulated nodes: Laptop, Desktop, Server.
    Verify Planner never selects node by ID. Planner only selects capability.
    """
    colony = SimulatedColony()
    
    laptop = FakeCapabilityNode(node_id="laptop", capabilities=["browser", "filesystem", "vision", "ocr"])
    desktop = FakeCapabilityNode(node_id="desktop", capabilities=["browser", "filesystem"])
    server = FakeCapabilityNode(node_id="server", capabilities=["gpu", "70b-model", "ai.summarize"])
    
    colony.add_node(laptop)
    colony.add_node(desktop)
    colony.add_node(server)
    
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="test-phase4")
    await harness.start()
    
    try:
        need = "OCR a document and summarize it with 70b-model"
        
        # We need to simulate discovery so the harness node sees the colony's capabilities.
        # Currently, planner just queries SkillRegistry. 
        # But we verify the DAG produced by the planner conforms to the rule:
        # Planner MUST NOT emit node IDs. It must emit capabilities/skills.
        
        dag = await harness.submit_need(need)
        
        # Verify planner outputs
        assert dag is not None
        assert "nodes" in dag
        
        skills_used = [node["skill"] for node in dag["nodes"]]
        
        # Ensure no node ID is used as a skill or hardcoded in the node definitions.
        # Planners should only select abstract skills/capabilities.
        for node in dag["nodes"]:
            assert node["skill"] not in ["laptop", "desktop", "server"], "Planner selected a physical node ID instead of a capability"
            assert "node_id" not in node, "Planner hardcoded a physical node ID in the DAG"
        
        print(f"Discovered DAG skills/capabilities: {skills_used}")
    finally:
        await harness.stop()
        await colony.stop_all()
