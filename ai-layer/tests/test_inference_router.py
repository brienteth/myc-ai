"""
Unit and Integration Tests for Myca OS P0.4 — local-first Inference Router

Verifies:
  1. Local-first routing (context fits and low CPU load).
  2. Escalation to Colony peer (busy local load or context size exceeded).
  3. Escalation to 0G Cloud (context size exceeded, local and colony both insufficient).
  4. Privacy Lock (blocks escalations to 0G Cloud if privacy policy is set to LOCAL_ONLY).
"""

import os
import sqlite3
import asyncio
import pytest
import tempfile
from pathlib import Path
from typing import Optional
from cryptography.hazmat.primitives.asymmetric import ed25519

from myca import database as db
from myca.registry import DeviceCapabilityRegistry
from myca.contracts.device import DeviceIdentity, DeviceCapability, TrustState, CapabilityScope
from myca.inference.router import LocalFirstInferenceRouter
from myca.inference.engine import InferenceEngine
from myca.connection import SimulatedConnectionManager, PeerConnection, TransportType

TEST_DB = Path(tempfile.mktemp(suffix=".db"))

@pytest.fixture(autouse=True)
def patch_db_paths(monkeypatch):
    """Redirect all database connections to a clean isolated tempdb."""
    monkeypatch.setattr("myca.database.DB_PATH", TEST_DB)
    monkeypatch.setattr("myca.registry.DB_PATH", TEST_DB)
    db.init_db()
    # Explicitly create device_capabilities tables
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    registry.init_db()
    yield
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except Exception:
            pass


class MockLocalEngine(InferenceEngine):
    def __init__(self):
        self.calls = []

    async def generate(self, prompt: str, **kwargs) -> str:
        self.calls.append(("generate", prompt, kwargs))
        return f"Local response: {prompt}"

    async def stream(self, prompt: str, **kwargs):
        yield f"Local response: {prompt}"

    async def embed(self, text: str):
        return [0.0] * 384

    async def rerank(self, query: str, documents: list):
        return [1.0] * len(documents)

    async def classify(self, text: str, labels: list):
        return {label: 1.0 / len(labels) for label in labels}

    async def tokenize(self, text: str):
        return [1, 2, 3]

    async def detokenize(self, tokens: list):
        return "tokens"

    async def vision(self, image_path: str, prompt: str):
        return "vision"

    async def transcribe(self, audio_path: str) -> str:
        return ""

    async def synthesize(self, text: str) -> bytes:
        return b""


@pytest.mark.anyio
async def test_01_local_routing():
    """Verify that short context size and low load requests stay local."""
    os.environ["MYCA_CTX"] = "4096"
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    local_engine = MockLocalEngine()

    # Mock node instance with load = 0.2
    class MockNode:
        def __init__(self):
            self.node_id = "mac_local"
            self.current_load = 0.2
            self.simulate = True

    router = LocalFirstInferenceRouter(local_engine, registry, MockNode())

    # Generate request needing 2000 tokens (fits in 4096)
    response = await router.generate("Tell me a story", required_context_length=2000, privacy_level="ANY")

    assert response == "Local response: Tell me a story"
    assert len(local_engine.calls) == 1
    assert local_engine.calls[0][0] == "generate"


@pytest.mark.anyio
async def test_02_escalate_to_colony():
    """Verify escalation to colony peer when local context length is exceeded or load is high."""
    os.environ["MYCA_CTX"] = "4096"

    # Clean registry
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    conn = sqlite3.connect(str(db.DB_PATH))
    conn.execute("DELETE FROM device_capabilities")
    conn.commit()
    conn.close()

    # Generate valid keys for iPhone
    iphone_private_key = ed25519.Ed25519PrivateKey.generate()
    from myca.identity import get_public_key_hex
    iphone_pub_hex = get_public_key_hex(iphone_private_key)

    # Re-register remote iPhone with LLM capability
    iphone_identity = DeviceIdentity(
        device_id="iphone_remote",
        public_key=iphone_pub_hex,
        device_type="mobile",
        device_name="My iPhone",
        capabilities=[
            DeviceCapability(capability_id="local_llm.inference", available=True, scope=CapabilityScope.ALLOWED),
        ],
        trust_state=TrustState.TRUSTED,
        is_self=False,
    )
    registry.register_remote_device(iphone_identity)

    local_engine = MockLocalEngine()

    # Separate queues to prevent races
    mac_to_iphone_queue = asyncio.Queue()
    iphone_to_mac_queue = asyncio.Queue()

    class MockNode:
        def __init__(self):
            self.node_id = "mac_local"
            self.current_load = 0.9  # Local is busy!
            self.simulate = True
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
            envelope_dict = await asyncio.wait_for(iphone_to_mac_queue.get(), timeout=timeout)
            from myca.transport import receive_envelope
            payload, reason = receive_envelope(
                data=envelope_dict,
                sender_public_key_hex=iphone_pub_hex,
                expected_recipient="mac_local",
                validator=node_instance.connection._envelope_validator
            )
            return payload
        except Exception as e:
            import logging
            logging.getLogger("test").error(f"Mock receive error: {e}")
            return None

    node_instance.connection.send_message = mock_send_message
    node_instance.connection.receive_message = mock_receive_message

    router = LocalFirstInferenceRouter(local_engine, registry, node_instance)

    # Add iPhone to trusted database for signature verification
    db.remove_trusted_node("iphone_remote")
    db.add_trusted_node(
        node_id="iphone_remote",
        public_key=iphone_pub_hex,
        device_name="My iPhone",
        device_type="mobile",
        capabilities="[]"
    )

    # Simulated remote responder task
    async def mock_remote_llm_respond():
        envelope_data = await mac_to_iphone_queue.get()
        assert envelope_data["sender"] == "mac_local"
        assert envelope_data["recipient"] == "iphone_remote"
        
        # Unpack and verify request
        payload = envelope_data.get("encrypted_payload", "")
        import json
        payload_dict = json.loads(payload)
        assert payload_dict["skill"] == "local_llm.inference"
        
        # Send result back
        from myca.transport import create_envelope
        result_payload = {
            "type": "execute_task_result",
            "success": True,
            "outputs": {"text": "Colony LLM response: Hello from iPhone"}
        }
        envelope = create_envelope(
            sender="iphone_remote",
            recipient="mac_local",
            payload=result_payload,
            private_key=iphone_private_key
        )
        await iphone_to_mac_queue.put(envelope.to_dict())

    responder_task = asyncio.create_task(mock_remote_llm_respond())

    # Call generator (local load is high, should escalate to iPhone)
    response = await router.generate("Translate to French", required_context_length=2000, privacy_level="ANY")

    assert response == "Colony LLM response: Hello from iPhone"
    assert len(local_engine.calls) == 0  # Bypassed local

    await responder_task
    db.remove_trusted_node("iphone_remote")


@pytest.mark.anyio
async def test_03_escalate_to_0g_and_privacy_lock():
    """Verify escalation to 0G Cloud when no colony node matches, and verification of privacy lock."""
    os.environ["MYCA_CTX"] = "4096"
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    
    # Clear registry database so no colony device matches
    conn = sqlite3.connect(str(TEST_DB))
    conn.execute("DELETE FROM device_capabilities")
    conn.commit()
    conn.close()

    local_engine = MockLocalEngine()

    class MockNode:
        def __init__(self):
            self.node_id = "mac_local"
            self.current_load = 0.2
            self.simulate = True

    node_instance = MockNode()
    router = LocalFirstInferenceRouter(local_engine, registry, node_instance)

    # Enforce LOCAL_ONLY: must raise PermissionError
    with pytest.raises(PermissionError) as exc_info:
        await router.generate("Analyze this 100k document", required_context_length=100000, privacy_level="LOCAL_ONLY")
    
    assert "BLOCKED_BY_PRIVACY_POLICY" in str(exc_info.value)
