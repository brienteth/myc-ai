import pytest
import asyncio
from myca.testing.colony import SimulatedColony
from myca.testing.harness import RuntimeTestHarness
from myca.skills.core.decorator import skill
from myca.execution.transport.base import ExecutionTask
from myca.execution.transport.mock import MockTransport
from myca.discovery import PeerInfo

@skill(id="long_skill")
async def dummy_long(ctx, data: str):
    return {"status": "ok"}

class CancellableMockTransport(MockTransport):
    async def stream(self, task: ExecutionTask, target_node: str = None):
        yield {"event": "Started"}
        try:
            for i in range(10):
                await asyncio.sleep(0.5)
                yield {"event": "Progress", "step": i}
            yield {"event": "Completed"}
        except asyncio.CancelledError:
            yield {"event": "Cancelled"}
            raise

@pytest.mark.asyncio
async def test_phase9_cancellation():
    """
    PHASE 9: CANCELLATION TEST
    Verify that cancelling the execution stream properly terminates the remote operation.
    """
    colony = SimulatedColony()
    await colony.start_all()
    
    harness = RuntimeTestHarness(node_id="node-a")
    await harness.start()
    
    harness.node.capabilities = []
    harness.node.discovery.peers["node-b"] = PeerInfo(
        node_id="node-b", role="worker", host="127.0.0.1", port=0,
        status="active", latency_ms=10.0, capabilities=["long_skill"]
    )
    
    original_is_local = harness.node.runtime.execution_bus._is_local_skill
    harness.node.runtime.execution_bus._is_local_skill = lambda skill_id: skill_id in harness.node.capabilities
    
    bus = harness.node.runtime.execution_bus
    bus.remote_transport = CancellableMockTransport()

    task = ExecutionTask(
        skill_id="long_skill",
        inputs={"data": "test"},
        task_id="T1",
        context=None
    )
    
    events = []
    
    async def consume_stream():
        async for event in bus.stream(task):
            events.append(event["event"])
            if event["event"] == "Progress" and event.get("step") == 2:
                # Cancel after 2 progress updates
                break

    stream_task = asyncio.create_task(consume_stream())
    await stream_task
    
    try:
        assert "Started" in events
        assert "Progress" in events
        assert "Completed" not in events
    finally:
        harness.node.runtime.execution_bus._is_local_skill = original_is_local
        await harness.stop()
        await colony.stop_all()
