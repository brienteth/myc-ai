"""
Myca OS — Colony Transport Envelope (P0.2)

Every message between Colony nodes is wrapped in a TransportEnvelope that
provides:
  1. Sender/Recipient identification (device_id)
  2. Ed25519 signature over the payload (integrity + authenticity)
  3. Nonce-based replay protection (SQLite-backed nonce cache)
  4. Timestamp expiry validation (max 120s clock drift)

The envelope is transport-agnostic — it wraps the JSON payload regardless of
whether the underlying channel is HTTP/2, WebRTC, or simulated queue.

Key Design Decisions:
  - Signature covers: sender + recipient + nonce + timestamp + payload_json
  - Nonce cache is bounded (auto-prune entries older than 300s)
  - Envelope is JSON-serializable for easy wire transport
"""

import hashlib
import json
import logging
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple

from myca.identity import sign_message, verify_signature

logger = logging.getLogger("myca.transport")

DB_PATH = Path("~/.myca/myca.db").expanduser()

# Maximum age of a valid envelope (seconds)
ENVELOPE_MAX_AGE_SECONDS = 120.0

# Maximum age before pruning nonces from cache (seconds)
NONCE_CACHE_TTL_SECONDS = 300.0


@dataclass
class TransportEnvelope:
    """
    Signed, replay-protected message envelope for Colony P2P communication.
    Supports optional encryption using the peer's shared key (AES-256-GCM).
    
    Wire format:
    {
        "sender": "m_abc123",
        "recipient": "m_def456",
        "nonce": "a1b2c3d4e5f6...",
        "timestamp": 1786789672.28,
        "encrypted_payload": "ciphertext_hex",  # Hex-encoded ciphertext
        "signature": "ed25519_sig_hex"
    }
    """
    sender: str
    recipient: str
    nonce: str = field(default_factory=lambda: secrets.token_hex(16))
    timestamp: float = field(default_factory=time.time)
    encrypted_payload: str = ""
    payload: dict = field(default_factory=dict)  # In-memory plain payload
    signature: str = ""

    # ── Cryptographic operations (P0.2 Encryption) ────────────────────

    def encrypt(self, crypto) -> "TransportEnvelope":
        """Encrypt self.payload to self.encrypted_payload using the shared key."""
        if not self.payload:
            self.encrypted_payload = ""
            return self
        try:
            plaintext = json.dumps(self.payload).encode("utf-8")
            ciphertext = crypto.encrypt(self.recipient, plaintext)
            self.encrypted_payload = ciphertext.hex()
        except Exception as e:
            logger.warning(f"[TRANSPORT] Encryption failed: {e}. Sending plaintext payload.")
            self.encrypted_payload = json.dumps(self.payload)
        return self

    def decrypt(self, crypto) -> "TransportEnvelope":
        """Decrypt self.encrypted_payload to self.payload using the shared key."""
        if not self.encrypted_payload:
            self.payload = {}
            return self
        try:
            ciphertext = bytes.fromhex(self.encrypted_payload)
            plaintext = crypto.decrypt(self.sender, ciphertext)
            self.payload = json.loads(plaintext.decode("utf-8"))
        except Exception as e:
            # Fallback if it wasn't hex/encrypted (e.g. plaintext pairing message)
            try:
                self.payload = json.loads(self.encrypted_payload)
            except Exception:
                logger.warning(f"[TRANSPORT] Decryption failed: {e}")
                self.payload = {}
        return self

    # ── Canonical Message for Signing ──────────────────────────────────

    def _canonical_message(self) -> bytes:
        """
        Produce the canonical byte string that is signed/verified.
        Uses sorted keys and separators to ensure identical bytes on both ends.
        We sign the encrypted payload to implement Encrypt-then-Sign.
        """
        canonical = json.dumps({
            "sender": self.sender,
            "recipient": self.recipient,
            "nonce": self.nonce,
            "timestamp": self.timestamp,
            "encrypted_payload": self.encrypted_payload,
        }, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return canonical

    # ── Sign / Verify ──────────────────────────────────────────────────

    def sign(self, private_key) -> "TransportEnvelope":
        """Sign the envelope with the sender's Ed25519 private key."""
        msg = self._canonical_message()
        sig_bytes = sign_message(private_key, msg)
        self.signature = sig_bytes.hex()
        return self

    def verify(self, sender_public_key_hex: str) -> bool:
        """Verify the envelope's signature against the sender's public key."""
        if not self.signature:
            logger.warning("[TRANSPORT] Envelope has no signature")
            return False
        msg = self._canonical_message()
        return verify_signature(sender_public_key_hex, msg, self.signature)

    # ── Serialization ──────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "sender": self.sender,
            "recipient": self.recipient,
            "nonce": self.nonce,
            "timestamp": self.timestamp,
            "encrypted_payload": self.encrypted_payload,
            "signature": self.signature,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, d: dict) -> "TransportEnvelope":
        return cls(
            sender=d.get("sender", ""),
            recipient=d.get("recipient", ""),
            nonce=d.get("nonce", ""),
            timestamp=d.get("timestamp", 0.0),
            encrypted_payload=d.get("encrypted_payload", ""),
            signature=d.get("signature", ""),
        )

    @classmethod
    def from_json(cls, json_str: str) -> "TransportEnvelope":
        return cls.from_dict(json.loads(json_str))


class NonceCache:
    """
    SQLite-backed nonce cache for replay protection.
    
    Every received nonce is stored with its timestamp.
    Duplicate nonces within the TTL window are rejected.
    Old nonces are periodically pruned.
    """

    def __init__(self):
        self._init_table()

    def _init_table(self):
        """Create the nonce cache table if it doesn't exist."""
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH))
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS transport_nonce_cache (
                nonce       TEXT PRIMARY KEY,
                sender      TEXT NOT NULL,
                received_at REAL NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_nonce_received
                ON transport_nonce_cache(received_at);
        """)
        conn.commit()
        conn.close()

    def check_and_store(self, nonce: str, sender: str) -> bool:
        """
        Check if nonce has been seen before.
        Returns True if nonce is fresh (not a replay).
        Returns False if nonce is a replay (already seen).
        """
        conn = sqlite3.connect(str(DB_PATH))
        try:
            # Check for existing nonce
            existing = conn.execute(
                "SELECT 1 FROM transport_nonce_cache WHERE nonce = ?", (nonce,)
            ).fetchone()

            if existing:
                logger.warning(f"[TRANSPORT] REPLAY DETECTED: nonce={nonce[:16]}... sender={sender}")
                return False

            # Store the nonce
            conn.execute(
                "INSERT INTO transport_nonce_cache (nonce, sender, received_at) VALUES (?, ?, ?)",
                (nonce, sender, time.time())
            )
            conn.commit()
            return True
        finally:
            conn.close()

    def prune(self):
        """Remove nonces older than the TTL."""
        cutoff = time.time() - NONCE_CACHE_TTL_SECONDS
        conn = sqlite3.connect(str(DB_PATH))
        deleted = conn.execute(
            "DELETE FROM transport_nonce_cache WHERE received_at < ?", (cutoff,)
        ).rowcount
        conn.commit()
        conn.close()
        if deleted:
            logger.info(f"[TRANSPORT] Pruned {deleted} expired nonces from cache")


class EnvelopeValidator:
    """
    Validates incoming TransportEnvelopes against:
      1. Timestamp freshness (reject if older than ENVELOPE_MAX_AGE_SECONDS)
      2. Nonce uniqueness (reject replayed messages)
      3. Ed25519 signature (reject tampered messages)
    """

    def __init__(self):
        self.nonce_cache = NonceCache()
        self._prune_counter = 0

    def validate(
        self,
        envelope: TransportEnvelope,
        sender_public_key_hex: str,
        expected_recipient: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Validate a received envelope.
        
        Returns:
            (True, "OK") on success
            (False, "reason") on failure
        """
        # 1. Recipient check
        if expected_recipient and envelope.recipient != expected_recipient:
            return False, "IDENTITY_MISMATCH"

        # 2. Timestamp freshness
        age = abs(time.time() - envelope.timestamp)
        if age > ENVELOPE_MAX_AGE_SECONDS:
            return False, "TIMESTAMP_EXPIRED"

        # 3. Nonce replay check
        is_fresh = self.nonce_cache.check_and_store(envelope.nonce, envelope.sender)
        if not is_fresh:
            return False, "REPLAY_REJECTED"

        # 4. Signature verification
        if not envelope.verify(sender_public_key_hex):
            return False, "SIGNATURE_INVALID"

        # Periodic nonce pruning (every 50 validations)
        self._prune_counter += 1
        if self._prune_counter >= 50:
            self.nonce_cache.prune()
            self._prune_counter = 0

        return True, "OK"


def create_envelope(
    sender: str,
    recipient: str,
    payload: dict,
    private_key,
    crypto=None,
) -> TransportEnvelope:
    """
    Create, optionally encrypt, and sign a new TransportEnvelope.
    """
    envelope = TransportEnvelope(
        sender=sender,
        recipient=recipient,
        payload=payload,
    )
    if crypto:
        envelope.encrypt(crypto)
    else:
        envelope.encrypted_payload = json.dumps(payload)
    envelope.sign(private_key)
    return envelope


def receive_envelope(
    data: dict,
    sender_public_key_hex: str,
    expected_recipient: str,
    validator: Optional[EnvelopeValidator] = None,
    crypto=None,
) -> Tuple[Optional[dict], str]:
    """
    Receive, validate, and optionally decrypt a TransportEnvelope from wire data.
    """
    if validator is None:
        validator = EnvelopeValidator()

    envelope = TransportEnvelope.from_dict(data)
    ok, reason = validator.validate(envelope, sender_public_key_hex, expected_recipient)

    if not ok:
        return None, reason

    if crypto:
        envelope.decrypt(crypto)
        return envelope.payload, "OK"
    else:
        # If no crypto, try to parse it from encrypted_payload directly (e.g. if plaintext)
        try:
            plain_payload = json.loads(envelope.encrypted_payload)
            return plain_payload, "OK"
        except Exception:
            return None, "PAYLOAD_DECRYPTION_FAILED: no crypto manager provided"
