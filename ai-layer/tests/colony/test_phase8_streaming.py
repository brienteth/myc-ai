import pytest
import asyncio
from typing import AsyncGenerator
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.skills.core.decorator import skill
from myca.execution.transport.base import ExecutionTask
from myca.execution.transport.mock import MockTransport
from myca.discovery import PeerInfo

@skill(id="streaming_skill")
async def dummy_streaming(ctx, data: str):
    # This won't actually be executed by MockTransport in streaming mode unless MockTransport runs it 
    # but let's assume we just mock the generator for the test to prove ExecutionBus routes correctly.
    return {"status": "ok"}

class StreamingMockTransport(MockTransport):
    async def stream(self, task: ExecutionTask, target_node: str = None):
        yield {"event": "Started", "node": target_node}
        await asyncio.sleep(0.01)
        yield {"event": "Progress", "percent": 50, "node": target_node}
        await asyncio.sleep(0.01)
        yield {"event": "Artifact", "uri": "file://artifact.png", "node": target_node}
        await asyncio.sleep(0.01)
        yield {"event": "Completed", "node": target_node}

@pytest.mark.asyncio
async def test_phase8_streaming():
    """
    PHASE 8: STREAMING TEST
    Remote node emits Started, Progress, Artifact, Completed.
    Verify ExecutionBus forwards this stream perfectly.
    """
    colony = SimulatedColony()
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = []
    harness.node.discovery.peers["node-b"] = PeerInfo(
        node_id="node-b", role="worker", host="127.0.0.1", port=0,
        status="active", latency_ms=10.0, capabilities=["streaming_skill"]
    )
    
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    bus = harness.node.runtime.execution_bus
    bus.remote_transport = StreamingMockTransport()

    task = ExecutionTask(
        skill_id="streaming_skill",
        inputs={"data": "test"},
        task_id="T1",
        context=None
    )
    
    events = []
    try:
        async for event in bus.stream(task):
            events.append(event["event"])
            assert event["node"] == "node-b"
            
        assert events == ["Started", "Progress", "Artifact", "Completed"]
        
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
        await colony.stop_all()
