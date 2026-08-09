"""
Unit tests for Myca Cryptographic Secure Local Pairing & Handshake Protocol.
"""

import time
import pytest
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from myca import database as db
from myca.identity import (
    get_or_create_identity_key,
    get_public_key_hex,
    sign_message,
    verify_signature
)

def test_ed25519_identity_key_generation():
    """Test backend identity loading or generation."""
    key = get_or_create_identity_key()
    assert isinstance(key, ed25519.Ed25519PrivateKey)
    
    pub_hex = get_public_key_hex(key)
    assert len(pub_hex) == 64  # Ed25519 public keys are 32 bytes = 64 hex characters
    
    # Test signatures
    msg = b"hello test message"
    sig = sign_message(key, msg)
    assert len(sig) == 64  # Ed25519 signatures are 64 bytes
    
    # Test signature verification
    assert verify_signature(pub_hex, msg, sig.hex()) is True
    assert verify_signature(pub_hex, b"wrong message", sig.hex()) is False

def test_database_trusted_nodes_crud():
    """Test SQL persistence operations on trusted nodes."""
    node_id = "m_test_node_123"
    pub_key = "a" * 64
    
    # Initially none
    db.remove_trusted_node(node_id)
    assert db.get_trusted_node(node_id) is None
    
    # Add trust
    db.add_trusted_node(
        node_id=node_id,
        public_key=pub_key,
        device_name="Test Phone",
        device_type="mobile",
        capabilities='["inference"]'
    )
    
    retrieved = db.get_trusted_node(node_id)
    assert retrieved is not None
    assert retrieved["node_id"] == node_id
    assert retrieved["public_key"] == pub_key
    assert retrieved["device_name"] == "Test Phone"
    assert retrieved["trust_status"] == "trusted"
    
    # List trusted
    all_nodes = db.list_trusted_nodes()
    assert any(n["node_id"] == node_id for n in all_nodes)
    
    # Revoke trust
    db.remove_trusted_node(node_id)
    assert db.get_trusted_node(node_id) is None
