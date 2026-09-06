"""
Unit and Integration Tests for Myca OS P0.3 — Capability Scheduler

Verifies:
  1. Skill-to-Capability mapping.
  2. Dynamic device assignment (capability-driven, not device-type based).
  3. Execution graph routing (local tasks run locally, remote tasks route to peers).
  4. Gate Test: `camera` requirement selects iPhone; `local_llm` selects Mac.
"""

import asyncio
import time
import pytest
from typing import Optional
from cryptography.hazmat.primitives.asymmetric import ed25519

from myca import database as db
from myca.identity import get_or_create_identity_key, get_public_key_hex
from myca.contracts.device import DeviceIdentity, DeviceCapability, TrustState, CapabilityScope
from myca.registry import DeviceCapabilityRegistry
from myca.contracts.execution import ExecutionGraph, ExecutionNode, NodeState
from myca.execution.scheduler import ExecutionScheduler, CapabilityScheduler
from myca.execution.event_bus import ExecutionEventBus
from myca.skills.core.registry import SkillRegistry
from myca.skills.core.result import SkillResult
from myca.skills.core.context import SkillContext
from myca.skills.core.permissions import PermissionManager
from myca.connection import SimulatedConnectionManager, PeerConnection, TransportType


def test_01_skill_to_capability_mapping():
    """Verify that skills correctly map to their required capabilities."""
    registry = DeviceCapabilityRegistry(node_id="macbook_local")
    scheduler = CapabilityScheduler(registry)

    # Let's verify our mapping logic
    dummy_graph = ExecutionGraph({"nodes": []})
    
    # Check manual skill resolution
    assert scheduler.SKILL_CAPABILITY_MAP.get("camera.capture") == "camera.capture"
    assert scheduler.SKILL_CAPABILITY_MAP.get("camera.read") == "camera.capture"
    assert scheduler.SKILL_CAPABILITY_MAP.get("local_llm.inference") == "local_llm.inference"


def test_02_dynamic_capability_scheduling():
    """Verify that steps are assigned dynamically by looking up capability IDs."""
    # Initialize a registry and clear db
    registry = DeviceCapabilityRegistry(node_id="macbook_local")
    # Clear device registry tables
    import sqlite3
    from myca.registry import DB_PATH
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM device_capabilities")
    conn.commit()
    conn.close()

    # 1. Register Local Macbook (with LLM, no Camera)
    mac_capabilities = [
        DeviceCapability(capability_id="local_llm.inference", available=True, scope=CapabilityScope.ALLOWED),
        DeviceCapability(capability_id="filesystem.read", available=True, scope=CapabilityScope.ALLOWED),
    ]
    mac_identity = DeviceIdentity(
        device_id="macbook_local",
        public_key="mac_pub_key",
        device_type="mac",
        device_name="My MacBook",
        capabilities=mac_capabilities,
        trust_state=TrustState.TRUSTED,
        is_self=True,
    )
    registry.register_remote_device(mac_identity) # registers as self/local if is_self=True

    # 2. Register Remote iPhone (with Camera, no LLM)
    iphone_capabilities = [
        DeviceCapability(capability_id="camera.capture", available=True, scope=CapabilityScope.ALLOWED),
    ]
    iphone_identity = DeviceIdentity(
        device_id="iphone_remote",
        public_key="iphone_pub_key",
        device_type="mobile",
        device_name="My iPhone",
        capabilities=iphone_capabilities,
        trust_state=TrustState.TRUSTED,
        is_self=False,
    )
    registry.register_remote_device(iphone_identity)

    # 3. Create a 2-step test DAG: step 1 (take photo), step 2 (extract text/inference)
    dag_dict = {
        "nodes": [
            {"id": "step_photo", "skill": "camera.capture", "inputs": {}, "deps": []},
            {"id": "step_llm", "skill": "local_llm.inference", "inputs": {"prompt": "Analyze photo"}, "deps": ["step_photo"]}
        ]
    }
    graph = ExecutionGraph(dag_dict)

    # Run capability scheduler
    cap_scheduler = CapabilityScheduler(registry)
    assignments = cap_scheduler.schedule(graph)

    # Verify dynamic capability routing
    assert assignments["step_photo"] == "iphone_remote"
    assert assignments["step_llm"] == "macbook_local"


@pytest.mark.asyncio
async def test_03_remote_routing_execution():
    """Verify that remote execution requests route to peers and local runs locally."""
    async def run_test():
        # Clean registry and database
        registry = DeviceCapabilityRegistry(node_id="mac_local")
        import sqlite3
        from myca.registry import DB_PATH
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM device_capabilities")
        conn.commit()
        conn.close()

        # Re-register MacBook (local) and iPhone (remote)
        mac_identity = DeviceIdentity(
            device_id="mac_local",
            public_key="mac_pub",
            device_type="mac",
            device_name="My Mac",
            capabilities=[
                DeviceCapability(capability_id="local_llm.inference", available=True, scope=CapabilityScope.ALLOWED),
                DeviceCapability(capability_id="gpu.compute", available=True, scope=CapabilityScope.ALLOWED),
            ],
            trust_state=TrustState.TRUSTED,
            is_self=True,
        )
        registry.register_remote_device(mac_identity)

        iphone_identity = DeviceIdentity(
            device_id="iphone_remote",
            public_key="iphone_pub",
            device_type="mobile",
            device_name="My iPhone",
            capabilities=[
                DeviceCapability(capability_id="camera.capture", available=True, scope=CapabilityScope.ALLOWED),
            ],
            trust_state=TrustState.TRUSTED,
            is_self=False,
        )
        registry.register_remote_device(iphone_identity)

        # Mock Node structure
        # Setup separate queues to prevent races
        mac_to_iphone_queue = asyncio.Queue()
        iphone_to_mac_queue = asyncio.Queue()

        # Mock Node structure
        # Setup separate queues to prevent races
        mac_to_iphone_queue = asyncio.Queue()
        iphone_to_mac_queue = asyncio.Queue()

        # Generate a real valid key for iPhone
        iphone_private_key = ed25519.Ed25519PrivateKey.generate()
        from myca.identity import get_public_key_hex
        iphone_pub_hex = get_public_key_hex(iphone_private_key)

        class MockNode:
            def __init__(self):
                self.node_id = "mac_local"
                self.device_registry = registry
                self.simulate = True
                self.crypto = None
                
                # Mock connection manager and private keys
                self.connection = SimulatedConnectionManager(node_id="mac_local")
                self.connection.connections["iphone_remote"] = PeerConnection(
                    peer_id="iphone_remote",
                    transport=TransportType.SIMULATED
                )

        node_instance = MockNode()

        # Mock send_message for MacBook connection manager
        async def mock_send_message(peer_id: str, message: dict) -> dict:
            from myca.transport import create_envelope
            from myca.identity import get_or_create_identity_key
            private_key = get_or_create_identity_key()
            
            envelope = create_envelope(
                sender="mac_local",
                recipient=peer_id,
                payload=message,
                private_key=private_key
            )
            await mac_to_iphone_queue.put(envelope.to_dict())
            return {"status": "sent", "peer_id": peer_id, "envelope": envelope.to_dict()}

        # Mock receive_message for MacBook connection manager
        async def mock_receive_message(peer_id: str, timeout: float = 5.0) -> Optional[dict]:
            try:
                print("MOCK RECEIVE MESSAGE CALLED")
                envelope_dict = await asyncio.wait_for(iphone_to_mac_queue.get(), timeout=timeout)
                print(f"MOCK RECEIVE MESSAGE GOT ENVELOPE: {envelope_dict}")
                from myca.transport import receive_envelope
                payload, reason = receive_envelope(
                    data=envelope_dict,
                    sender_public_key_hex=iphone_pub_hex,
                    expected_recipient="mac_local",
                    validator=node_instance.connection._envelope_validator
                )
                print(f"MOCK RECEIVE MESSAGE DECRYPTED: payload={payload}, reason={reason}")
                return payload
            except Exception as e:
                import traceback
                print(f"Mock receive error: {e}\n{traceback.format_exc()}")
                return None

        node_instance.connection.send_message = mock_send_message
        node_instance.connection.receive_message = mock_receive_message

        # Add iPhone to trusted database for signature verification in simulation
        db.remove_trusted_node("iphone_remote")
        db.add_trusted_node(
            node_id="iphone_remote",
            public_key=iphone_pub_hex,
            device_name="My iPhone",
            device_type="mobile",
            capabilities="[]"
        )

        # Mock runtime context matching runtime.py
        class MockRuntime:
            def __init__(self):
                self.node = node_instance

        # Register local skill mock
        from myca.skills.core.decorator import skill
        @skill(id="local_llm.inference", inputs=["prompt"])
        async def dummy_llm(ctx, prompt):
            return SkillResult(success=True, outputs={"text": f"Processed: {prompt}"})

        # Submit task queue task response simulation in background
        async def mock_remote_device_respond():
            try:
                print("MOCK RESPONDER WAITING FOR ENVELOPE")
                # Await incoming envelope from MacBook on A->B queue
                envelope_data = await mac_to_iphone_queue.get()
                print(f"MOCK RESPONDER GOT ENVELOPE: {envelope_data}")
                
                # Simulated iPhone process
                assert envelope_data["sender"] == "mac_local"
                assert envelope_data["recipient"] == "iphone_remote"
                
                # Send result envelope back to MacBook's B->A inbox queue
                from myca.transport import create_envelope
                result_payload = {
                    "type": "execute_task_result",
                    "success": True,
                    "outputs": {"photo_url": "file:///photos/invoice.jpg"}
                }
                
                # Sign with iPhone's private key
                response_envelope = create_envelope(
                    sender="iphone_remote",
                    recipient="mac_local",
                    payload=result_payload,
                    private_key=iphone_private_key
                )
                print(f"MOCK RESPONDER SENDING RESPONSE: {response_envelope.to_dict()}")
                # Put response in B->A queue
                await iphone_to_mac_queue.put(response_envelope.to_dict())
            except Exception as e:
                import traceback
                print(f"Mock responder error: {e}\n{traceback.format_exc()}")

        # Start mock responder task
        responder_task = asyncio.create_task(mock_remote_device_respond())

        # Setup Graph and Run Scheduler
        dag_dict = {
            "nodes": [
                {"id": "step_photo", "skill": "camera.capture", "inputs": {}, "deps": []},
                {"id": "step_llm", "skill": "local_llm.inference", "inputs": {"prompt": "Analyze photo"}, "deps": ["step_photo"]}
            ]
        }
        graph = ExecutionGraph(dag_dict)

        # Link graph nodes to each node object
        for node_id, node in graph.nodes.items():
            node.graph = graph

        # Run scheduler
        scheduler = ExecutionScheduler(event_bus=ExecutionEventBus())
        
        # SkillContext
        perms = PermissionManager()
        perms.request(["fs", "browser", "network"])
        ctx = SkillContext(
            need_id="test_need",
            runtime=MockRuntime(),
            memory=None,
            capabilities=None,
            permissions=perms
        )

        success = await scheduler.run(graph, ctx, workflow_id="wf-test-scheduler")
        print(f"SCHEDULER SUCCESS: {success}")
        photo_node = graph.nodes["step_photo"]
        llm_node = graph.nodes["step_llm"]
        print(f"PHOTO NODE: assigned={getattr(photo_node, 'assigned_device_id', None)}, status={photo_node.status}, result={photo_node.result}")
        print(f"LLM NODE: assigned={getattr(llm_node, 'assigned_device_id', None)}, status={llm_node.status}, result={llm_node.result}")
        
        assert success is True
        assert photo_node.result is not None, f"photo_node.result is None! status={photo_node.status}"
        assert "photo_url" in photo_node.result.outputs, f"photo_url key missing from outputs: {photo_node.result.outputs}. assigned={getattr(photo_node, 'assigned_device_id', None)}"
        assert photo_node.result.outputs["photo_url"] == "file:///photos/invoice.jpg"
        assert photo_node.status == NodeState.COMPLETED
        assert llm_node.status == NodeState.COMPLETED

        # Cleanup
        responder_task.cancel()
        try:
            await responder_task
        except asyncio.CancelledError:
            pass
        db.remove_trusted_node("iphone_remote")

    await run_test()
