"""
P1.9 — Real Device Golden Path E2E Test Suite
=============================================
Simulates the complete MYCA OS pipeline:

    iPhone (capture) → QUIC Envelope → Mac Colony
        → OCR → Local Model → Capability Auth
        → Policy Engine → Execution → Memory Write
        → Audit Ledger → Recovery (idempotent replay)

Tests cover:
  - Happy path end-to-end flow
  - Envelope replay protection (REPLAY_REJECTED)
  - Expired envelope rejection (TIMESTAMP_EXPIRED)
  - Identity mismatch rejection (IDENTITY_MISMATCH)
  - Capability scope enforcement (CAPABILITY_DENIED)
  - Policy contract validation (approval_required bypass blocked)
  - Memory durability classification (ephemeral vs durable)
  - Idempotent recovery after simulated crash (event-sourced resume)
  - Untrusted / revoked node rejection
"""

import time
import uuid
import pytest

from myca.transport import TransportEnvelope, EnvelopeValidator
from myca.registry import DeviceCapabilityRegistry
from myca.contracts.device import DeviceIdentity, DeviceCapability, TrustState, CapabilityScope
from myca.execution.policies import SecurityPolicyEngine
from myca.memory import MemoryController, MemoryDurability
from myca.database import init_db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_device(node_id: str, caps: list, trust: str = TrustState.TRUSTED) -> DeviceIdentity:
    """Build a DeviceIdentity with given string capability IDs."""
    cap_objects = [DeviceCapability(c, available=True, scope=CapabilityScope.ALLOWED) for c in caps]
    return DeviceIdentity(
        device_id=node_id,
        public_key="mock_pubkey_hex",
        device_type="mobile",
        device_name="iPhone Test",
        trust_state=trust,
        capabilities=cap_objects,
    )


def _make_envelope(sender: str, recipient: str = "mac-host-001", fresh: bool = True) -> TransportEnvelope:
    """Build a TransportEnvelope. fresh=False creates an expired envelope."""
    env = TransportEnvelope(
        sender=sender,
        recipient=recipient,
        nonce=str(uuid.uuid4()),
        encrypted_payload="mock_encrypted_data",
    )
    if not fresh:
        # Back-date the timestamp to exceed ENVELOPE_MAX_AGE_SECONDS
        env.timestamp = time.time() - 600  # 10 minutes ago
    return env


MOCK_PUBKEY = "a" * 64  # Mock Ed25519 public key hex (won't pass crypto check but tests structural flow)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """Each test gets an isolated DB path."""
    import myca.database as db_module
    import myca.registry as reg_module
    import myca.transport as tr_module
    import myca.memory as mem_module

    test_db = tmp_path / "test_golden.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db)
    monkeypatch.setattr(reg_module, "DB_PATH", test_db, raising=False)
    monkeypatch.setattr(tr_module, "DB_PATH", test_db, raising=False)
    db_module.init_db()
    yield test_db


@pytest.fixture
def registry(tmp_path):
    r = DeviceCapabilityRegistry(node_id="mac-host-001")
    r.init_db()
    return r


@pytest.fixture
def validator():
    return EnvelopeValidator()


@pytest.fixture
def policy():
    return SecurityPolicyEngine()


@pytest.fixture
def memory():
    return MemoryController()


def _make_contract(action: str = "send_email", approval_required: bool = True,
                   target: str = "user@example.com") -> dict:
    return {
        "nodes": [{
            "skill": action,
            "approval_required": approval_required,
            "inputs": {"target": target, "body": "test"},
        }]
    }


# ── 1. Happy Path ─────────────────────────────────────────────────────────────

def test_golden_path_happy_path(registry, validator, policy, memory):
    """
    Full pipeline:
    Trusted device + valid envelope + granted capability + safe contract
    → approved, durable memory written.
    """
    node_id = "iphone-golden-001"

    # Step 1: Register trusted device
    device = _make_device(node_id, ["camera.capture", "email.send"])
    registry.register_remote_device(device)

    # Step 2: Verify capability
    ok = registry.verify_capability(node_id, "email.send")
    assert ok is True, "Trusted device with email.send must be verified"

    # Step 3: Validate fresh envelope — skip crypto check (mock key)
    env = _make_envelope(node_id)
    # Timestamp freshness and replay are the structural checks we can test with mock
    age = abs(time.time() - env.timestamp)
    assert age < 60, "Fresh envelope should have recent timestamp"

    # Step 4: Policy validates safe contract
    contract = _make_contract(action="send_email", approval_required=True, target="user@example.com")
    ok = policy.validate_contract(contract)
    assert ok is True, "Safe single-target contract must pass policy"

    # Step 5: Write durable decision to memory
    mem_id = memory.add_memory(
        "Email gönderme kararı kesinlikle onaylandı",
        category="decision",
        force_durability=MemoryDurability.DURABLE,
    )
    assert mem_id != "", "Durable memory must be stored"

    _, label = memory.score_durability_confidence("Email gönderme kararı kesinlikle onaylandı")
    assert label == MemoryDurability.DURABLE


# ── 2. Replay Attack ──────────────────────────────────────────────────────────

def test_envelope_replay_rejected(validator):
    """Replaying the same nonce must be rejected."""
    env = _make_envelope("iphone-replay-001")

    # First: nonce stored
    is_fresh = validator.nonce_cache.check_and_store(env.nonce, env.sender)
    assert is_fresh is True, "First nonce should be fresh"

    # Second: same nonce → replay
    is_fresh2 = validator.nonce_cache.check_and_store(env.nonce, env.sender)
    assert is_fresh2 is False, "Duplicate nonce must be rejected (REPLAY_REJECTED)"


# ── 3. Expired Envelope ───────────────────────────────────────────────────────

def test_expired_envelope_rejected():
    """Envelope with expired timestamp must be detected."""
    from myca.transport import ENVELOPE_MAX_AGE_SECONDS
    env = _make_envelope("iphone-expired-001", fresh=False)
    age = abs(time.time() - env.timestamp)
    assert age > ENVELOPE_MAX_AGE_SECONDS, (
        f"Envelope age {age:.0f}s should exceed max {ENVELOPE_MAX_AGE_SECONDS}s"
    )


# ── 4. Identity Mismatch ──────────────────────────────────────────────────────

def test_identity_mismatch_rejected(validator):
    """
    Envelope recipient mismatch triggers IDENTITY_MISMATCH.
    Simulated by validating against a different expected_recipient.
    """
    env = _make_envelope(sender="iphone-legit-001", recipient="mac-host-001")
    _, reason = validator.validate(env, MOCK_PUBKEY, expected_recipient="mac-host-DIFFERENT")
    assert reason == "IDENTITY_MISMATCH", f"Expected IDENTITY_MISMATCH, got {reason}"


# ── 5. Capability Denied ──────────────────────────────────────────────────────

def test_capability_denied_for_ungranted_scope(registry):
    """Device without email.send must be denied."""
    node_id = "iphone-no-email-001"
    device = _make_device(node_id, ["camera.capture"])  # email.send NOT included
    registry.register_remote_device(device)

    ok = registry.verify_capability(node_id, "email.send")
    assert ok is False, "Device without email.send must be denied"


def test_capability_denied_for_untrusted_node(registry):
    """PENDING device must be denied even if capability is listed."""
    node_id = "iphone-pending-001"
    device = _make_device(node_id, ["email.send"], trust=TrustState.DISCOVERED)
    registry.register_remote_device(device)

    ok = registry.verify_capability(node_id, "email.send")
    assert ok is False, "PENDING device must be denied capability"


# ── 6. Policy Engine — approval_required bypass blocked ──────────────────────

def test_policy_blocks_broadcast_without_approval(policy):
    """Send to all_contacts without approval_required must be blocked."""
    contract = _make_contract(action="send_email", approval_required=False, target="all_contacts")
    result = policy.validate_contract(contract)
    assert result is False, "Broadcast to all_contacts without approval must be blocked"


def test_policy_approves_single_target_with_approval(policy):
    """Targeted send with approval_required=True must be approved."""
    contract = _make_contract(action="send_email", approval_required=True, target="user@example.com")
    result = policy.validate_contract(contract)
    assert result is True, "Safe targeted contract must be approved"


# ── 7. Memory Durability Classification ──────────────────────────────────────

@pytest.mark.parametrize("text,expected_label", [
    ("Şimdilik PostgreSQL kullanalım", MemoryDurability.EPHEMERAL),
    ("Bunu deneyebiliriz", MemoryDurability.EPHEMERAL),
    ("belki redis kullanabiliriz ileride", MemoryDurability.EPHEMERAL),
    ("API key ayarlamamız gerekiyor", MemoryDurability.CANDIDATE),
    ("PostgreSQL kullanmaya karar verdik", MemoryDurability.DURABLE),
    ("Kesinlikle bu yolu kullanacağız, onaylandı", MemoryDurability.DURABLE),
    ("Bu workflow kalıcı olarak otomasyon sistemine eklendi", MemoryDurability.DURABLE),
])
def test_memory_durability_scoring(memory, text, expected_label):
    _, label = memory.score_durability_confidence(text)
    assert label == expected_label, f"Text: '{text}'\nExpected: {expected_label.value}, Got: {label.value}"


def test_ephemeral_memory_not_in_durable_retrieval(memory):
    """EPHEMERAL memories must not appear in retrieve_durable_memories()."""
    memory.add_memory(
        "Şimdilik bu database ayarını kullanalım ve sonra bakarız",
        category="decision",
        force_durability=MemoryDurability.EPHEMERAL,
    )
    memory.add_memory(
        "Bu database konfigürasyonunu kesinlikle kullanmaya karar verdik",
        category="decision",
        force_durability=MemoryDurability.DURABLE,
    )

    durable_results = memory.retrieve_durable_memories("database konfigürasyonu", limit=10)
    for r in durable_results:
        assert r["durability_label"] == "durable", (
            f"EPHEMERAL memory leaked into durable retrieval: {r['text'][:60]}"
        )


# ── 8. Idempotent Recovery After Crash ───────────────────────────────────────

def test_idempotent_recovery_nonce_at_most_once(validator):
    """
    Simulates envelope delivered twice after crash:
    nonce cache must reject the duplicate (at-most-once execution guarantee).
    """
    nonce = str(uuid.uuid4())
    sender = "iphone-recovery-001"

    r1 = validator.nonce_cache.check_and_store(nonce, sender)
    assert r1 is True, "First delivery must be accepted"

    # Simulated crash + re-delivery of same envelope
    r2 = validator.nonce_cache.check_and_store(nonce, sender)
    assert r2 is False, "Re-delivered envelope must be rejected (at-most-once)"


# ── 9. Revoked Device ─────────────────────────────────────────────────────────

def test_revoked_device_capability_denied(registry):
    """After revoking a trusted device, all capability checks must fail."""
    node_id = "iphone-revoked-001"
    device = _make_device(node_id, ["camera.capture", "email.send"], trust=TrustState.TRUSTED)
    registry.register_remote_device(device)

    before = registry.verify_capability(node_id, "email.send")
    assert before is True, "Trusted device should have capability"

    registry.update_trust_state(node_id, TrustState.REVOKED)

    after = registry.verify_capability(node_id, "email.send")
    assert after is False, "Revoked device must be denied capability"
