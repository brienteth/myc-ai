"""
Unit and Integration Tests for Myca OS P0.2 — Colony Transport Envelope

Verifies:
  1. Signed envelope creation and verification (Ed25519)
  2. Encrypted payload transit using Kyber/X25519 session keys (AES-256-GCM)
  3. Nonce-based replay protection (SQLite nonce cache rejects duplicates)
  4. Timestamp expiry validation (rejects messages older than 120s)
  5. Integration with SimulatedConnectionManager
"""

import asyncio
import time
import pytest
import json
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from myca import database as db
from myca.identity import get_or_create_identity_key, get_public_key_hex
from myca.crypto import MycaCrypto
from myca.transport import (
    TransportEnvelope,
    EnvelopeValidator,
    create_envelope,
    receive_envelope,
    ENVELOPE_MAX_AGE_SECONDS,
)
from myca.connection import SimulatedConnectionManager, PeerConnection, TransportType


def test_01_envelope_signing_and_verification():
    """Verify that envelopes can be signed and successfully verified using Ed25519."""
    private_key = get_or_create_identity_key()
    public_key_hex = get_public_key_hex(private_key)

    payload = {"type": "ping", "data": "hello"}
    envelope = create_envelope(
        sender="node_a",
        recipient="node_b",
        payload=payload,
        private_key=private_key,
    )

    assert envelope.sender == "node_a"
    assert envelope.recipient == "node_b"
    assert envelope.signature != ""

    # Verify signature
    assert envelope.verify(public_key_hex) is True

    # Tamper with payload
    envelope_dict = envelope.to_dict()
    envelope_dict["encrypted_payload"] = envelope_dict["encrypted_payload"] + "tampered"
    tampered_envelope = TransportEnvelope.from_dict(envelope_dict)
    assert tampered_envelope.verify(public_key_hex) is False


def test_02_nonce_replay_protection():
    """Verify that SQLite nonce cache prevents duplicate message replays."""
    private_key = get_or_create_identity_key()
    public_key_hex = get_public_key_hex(private_key)

    validator = EnvelopeValidator()
    
    payload = {"command": "delete_all"}
    envelope = create_envelope(
        sender="attacker",
        recipient="target",
        payload=payload,
        private_key=private_key,
    )

    # First receive: OK
    ok, reason = validator.validate(envelope, public_key_hex, expected_recipient="target")
    assert ok is True
    assert reason == "OK"

    # Second receive (replay): must be rejected
    ok2, reason2 = validator.validate(envelope, public_key_hex, expected_recipient="target")
    assert ok2 is False
    assert "REPLAY_REJECTED" in reason2  # P1.2: hardened label (was NONCE_REPLAY)


def test_03_timestamp_expiry_validation():
    """Verify that envelopes with expired timestamps are rejected."""
    private_key = get_or_create_identity_key()
    public_key_hex = get_public_key_hex(private_key)

    validator = EnvelopeValidator()

    # Expired message (130s ago)
    old_envelope = TransportEnvelope(
        sender="sender_a",
        recipient="recipient_b",
        timestamp=time.time() - (ENVELOPE_MAX_AGE_SECONDS + 10),
    )
    old_envelope.sign(private_key)

    ok, reason = validator.validate(old_envelope, public_key_hex, expected_recipient="recipient_b")
    assert ok is False
    assert "TIMESTAMP_EXPIRED" in reason


def test_04_encrypted_payload_transit():
    """Verify that payload can be encrypted/decrypted using shared session keys."""
    async def run_test():
        # Setup two mock nodes A and B with crypto states
        crypto_a = MycaCrypto()
        crypto_b = MycaCrypto()
        await crypto_a.initialize()
        await crypto_b.initialize()

        # Exchange keys (derive shared keys)
        pub_a = crypto_a.get_public_key_bytes()
        pub_b = crypto_b.get_public_key_bytes()

        await crypto_a.derive_shared_key("node_b", pub_b)
        await crypto_b.derive_shared_key("node_a", pub_a)

        private_key_a = get_or_create_identity_key()
        pub_key_a_hex = get_public_key_hex(private_key_a)

        # Node A creates secure envelope for Node B
        payload = {"confidential": "secret_agent_data"}
        envelope = create_envelope(
            sender="node_a",
            recipient="node_b",
            payload=payload,
            private_key=private_key_a,
            crypto=crypto_a,
        )

        # Ciphertext should be set, plaintext payload shouldn't be exposed on wire
        assert envelope.encrypted_payload != ""
        assert envelope.encrypted_payload != json.dumps(payload)

        # Node B receives and decrypts
        decrypted_payload, status = receive_envelope(
            data=envelope.to_dict(),
            sender_public_key_hex=pub_key_a_hex,
            expected_recipient="node_b",
            crypto=crypto_b,
        )

        assert status == "OK"
        assert decrypted_payload == payload

        await crypto_a.stop()
        await crypto_b.stop()

    asyncio.run(run_test())


def test_05_connection_manager_envelope_integration():
    """Verify that SimulatedConnectionManager wraps and validates envelopes on send/recv."""
    async def run_test():
        node_id_a = "sim_node_a"
        node_id_b = "sim_node_b"

        # Setup keys and trust
        key_a = ed25519.Ed25519PrivateKey.generate()
        pub_key_a_hex = key_a.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ).hex()

        # Pre-add node A to trusted database so B can verify it
        db.remove_trusted_node(node_id_a)
        db.add_trusted_node(
            node_id=node_id_a,
            public_key=pub_key_a_hex,
            device_name="Simulated Node A",
            device_type="desktop",
            capabilities="[]"
        )

        conn_a = SimulatedConnectionManager(node_id=node_id_a, private_key=key_a)
        conn_b = SimulatedConnectionManager(node_id=node_id_b)

        # Establish connection
        from types import SimpleNamespace
        peer_info_b = SimpleNamespace(node_id=node_id_b, host="127.0.0.1", port=0, source="mdns_local")
        
        await conn_a.connect_to_peer(peer_info_b)
        conn_a.connections[node_id_b].active = True
        
        # We must link queue of A to receive from B
        conn_b.connections[node_id_a] = PeerConnection(peer_id=node_id_a, transport=TransportType.SIMULATED)
        conn_b._queues[node_id_a] = conn_a._queues[node_id_b]

        # Node A sends message to Node B
        test_msg = {"type": "execute", "task": "hello"}
        send_res = await conn_a.send_message(node_id_b, test_msg)
        
        assert send_res["status"] == "sent"
        assert "envelope" in send_res
        
        envelope_data = send_res["envelope"]
        assert envelope_data["sender"] == node_id_a
        assert envelope_data["recipient"] == node_id_b

        # Node B receives message
        recv_msg = await conn_b.receive_message(node_id_a, timeout=1.0)
        assert recv_msg == test_msg

        # Cleanup DB
        db.remove_trusted_node(node_id_a)

    asyncio.run(run_test())
