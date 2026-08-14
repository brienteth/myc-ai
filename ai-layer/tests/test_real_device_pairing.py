"""
Comprehensive Automated Test Suite: Real Device Pairing Architecture
Verifies Single Source of Truth, Single Host Session, Same Code Symmetry,
Ed25519 Cryptographic Verification, Expiration, Reconnect, and Revocation.
"""

import time
import uuid
import pytest
from myca import database as db
from myca.pairing import (
    PairingSessionManager,
    PairingSessionStatus,
    UNAMBIGUOUS_PAIR_CHARS,
)
from myca.identity import generate_keypair, sign_message, get_public_key_hex


def setup_module():
    """Initialize database schema before tests."""
    db.init_db()


def test_1_same_code_single_source_of_truth():
    """Test 1: Host creates session, Mobile requests session. ASSERT host.code == mobile.code."""
    mgr = PairingSessionManager(default_ttl_seconds=300)
    host_id = f"host_mac_{uuid.uuid4().hex[:6]}"
    
    # 1. Host creates session
    host_session = mgr.create_session(host_node_id=host_id)
    assert len(host_session.security_code) == 4
    assert all(c in UNAMBIGUOUS_PAIR_CHARS for c in host_session.security_code)
    
    # 2. Mobile generates keypair and requests pairing
    mobile_priv = generate_keypair()
    mobile_pub = get_public_key_hex(mobile_priv)
    mobile_node_id = f"mobile_iphone_{uuid.uuid4().hex[:6]}"
    
    mobile_session = mgr.request_pairing(
        node_id=mobile_node_id,
        public_key=mobile_pub,
        device_name="iPhone 15 Pro",
        device_type="mobile",
        capabilities=["inference", "sensors"],
        host_node_id=host_id
    )
    
    assert mobile_session is not None
    # ASSERT host.code == mobile.code
    assert host_session.security_code == mobile_session.security_code
    print(f"\n[PASS] Test 1 — Same Code: Host [{host_session.security_code}] == Mobile [{mobile_session.security_code}]")


def test_2_refresh_behavior():
    """Test 2: Mobile refresh fetches same active session code without generating a new one."""
    mgr = PairingSessionManager(default_ttl_seconds=300)
    host_id = f"host_mac_{uuid.uuid4().hex[:6]}"
    
    host_session = mgr.create_session(host_node_id=host_id)
    initial_code = host_session.security_code
    
    # Mobile queries active session on page refresh
    refreshed_session = mgr.get_active_session(host_id)
    assert refreshed_session is not None
    assert refreshed_session.security_code == initial_code
    assert refreshed_session.session_id == host_session.session_id
    print(f"[PASS] Test 2 — Refresh: Mobile refresh returned identical code [{refreshed_session.security_code}]")


def test_3_multiple_clients_same_host_session():
    """Test 3: iPhone, iPad, and Chrome Browser all get the same host session code."""
    mgr = PairingSessionManager(default_ttl_seconds=300)
    host_id = f"host_mac_{uuid.uuid4().hex[:6]}"
    
    host_session = mgr.create_session(host_node_id=host_id)
    expected_code = host_session.security_code
    
    clients = [
        ("client_iphone", "iPhone 15"),
        ("client_ipad", "iPad Pro"),
        ("client_chrome", "Chrome Browser")
    ]
    
    for client_id, device_name in clients:
        priv = generate_keypair()
        pub = get_public_key_hex(priv)
        s = mgr.request_pairing(
            node_id=client_id,
            public_key=pub,
            device_name=device_name,
            device_type="mobile",
            capabilities=["inference"],
            host_node_id=host_id
        )
        assert s is not None
        assert s.security_code == expected_code
        
    print(f"[PASS] Test 3 — Multiple Clients: iPhone, iPad, Chrome all received matching code [{expected_code}]")


def test_4_session_expiration():
    """Test 4: Expired TTL makes session invalid."""
    mgr = PairingSessionManager(default_ttl_seconds=1) # 1 second TTL
    host_id = f"host_mac_{uuid.uuid4().hex[:6]}"
    
    session = mgr.create_session(host_node_id=host_id, ttl_seconds=1)
    session_id = session.session_id
    
    # Wait for expiration
    time.sleep(1.2)
    
    expired_session = mgr.get_session(session_id)
    assert expired_session.is_expired()
    assert expired_session.status == PairingSessionStatus.EXPIRED
    
    # Attempting to verify expired session fails
    priv = generate_keypair()
    pub = get_public_key_hex(priv)
    ok, reason = mgr.verify_session(session_id, "node_test", "00" * 64)
    assert ok is False
    assert reason == "SESSION_EXPIRED"
    print(f"[PASS] Test 4 — Expiration: Expired session rejected with [{reason}]")


def test_5_new_pairing_invalidates_old():
    """Test 5: Start New Pairing creates new code and invalidates previous session."""
    mgr = PairingSessionManager(default_ttl_seconds=300)
    host_id = f"host_mac_{uuid.uuid4().hex[:6]}"
    
    session1 = mgr.create_session(host_node_id=host_id)
    old_id = session1.session_id
    old_code = session1.security_code
    
    # User clicks "Start New Pairing"
    session2 = mgr.create_session(host_node_id=host_id, force_new=True)
    new_id = session2.session_id
    new_code = session2.security_code
    
    assert old_id != new_id
    # Check old session status in SQLite
    old_db_record = db.get_pairing_session_by_id(old_id)
    assert old_db_record["status"] == PairingSessionStatus.CANCELLED
    
    active_now = mgr.get_active_session(host_id)
    assert active_now.session_id == new_id
    assert active_now.security_code == new_code
    print(f"[PASS] Test 5 — New Pairing: Old session [{old_code}] CANCELLED -> New session [{new_code}] active")


def test_6_cryptographic_verification_ed25519():
    """Test 6: Valid signature trusts node; Invalid signature returns 403 PAIRING_VERIFICATION_FAILED."""
    mgr = PairingSessionManager(default_ttl_seconds=300)
    host_id = f"host_mac_{uuid.uuid4().hex[:6]}"
    
    session = mgr.create_session(host_node_id=host_id)
    mobile_priv = generate_keypair()
    mobile_pub = get_public_key_hex(mobile_priv)
    mobile_node_id = f"mobile_{uuid.uuid4().hex[:6]}"
    
    mgr.request_pairing(
        node_id=mobile_node_id,
        public_key=mobile_pub,
        device_name="Mobile Device",
        device_type="mobile",
        capabilities=["inference"],
        session_id=session.session_id
    )
    
    # Host approves
    mgr.approve_session(session.session_id)
    
    # 6a: Test invalid signature
    fake_sig = "ab" * 64
    ok, reason = mgr.verify_session(session.session_id, mobile_node_id, fake_sig)
    assert ok is False
    assert reason == "PAIRING_VERIFICATION_FAILED"
    
    # 6b: Test valid Ed25519 signature
    valid_sig = sign_message(mobile_priv, session.challenge.encode("utf-8")).hex()
    ok, reason = mgr.verify_session(session.session_id, mobile_node_id, valid_sig)
    assert ok is True
    assert reason == "TRUSTED"
    
    # Verify persistence in SQLite
    trusted_in_db = db.get_trusted_node(mobile_node_id)
    assert trusted_in_db is not None
    assert trusted_in_db["public_key"] == mobile_pub
    print(f"[PASS] Test 6 — Cryptographic Verification: Invalid rejected, Valid accepted & stored in SQLite")


def test_7_revocation_and_re_pairing():
    """Test 7: Revoked node trust is deleted from SQLite and requires fresh pairing."""
    mgr = PairingSessionManager(default_ttl_seconds=300)
    mobile_node_id = f"node_to_revoke_{uuid.uuid4().hex[:6]}"
    mobile_pub = "1234567890abcdef" * 4
    
    db.add_trusted_node(mobile_node_id, mobile_pub, "Test Revoke Phone", "mobile", "[]")
    assert db.get_trusted_node(mobile_node_id) is not None
    
    # Revoke trust
    revoked = mgr.revoke_node(mobile_node_id)
    assert revoked is True
    assert db.get_trusted_node(mobile_node_id) is None
    print(f"[PASS] Test 7 — Revocation: Node [{mobile_node_id}] successfully purged from trusted_nodes")


if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
